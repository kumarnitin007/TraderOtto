-- =============================================================================
-- Otto Vault — Supabase schema
-- Run in the Supabase SQL editor as the postgres role.
--
-- SECURITY MODEL
--   * Secret item/tag/history content is encrypted in the browser.
--   * Supabase stores ciphertext, nonces and non-secret routing metadata only.
--   * The user's master password and unwrapped vault key never reach Supabase.
--   * payload_ciphertext decrypts to flexible JSON, so adding fields normally
--     does not require a database migration.
-- =============================================================================

create extension if not exists "pgcrypto";

create or replace function ov_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function ov_reject_user_id_change()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot be changed';
  end if;
  return new;
end;
$$;

-- One key envelope per user. The browser derives a key from the master
-- password and uses it to unwrap the random vault key.
create table if not exists ov_vaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kdf_algorithm text not null default 'argon2id',
  kdf_salt bytea not null,
  kdf_params jsonb not null default '{"memoryKiB":65536,"iterations":3,"parallelism":1}'::jsonb,
  wrapped_vault_key bytea not null,
  wrap_nonce bytea not null,
  encrypted_verifier bytea not null,
  verifier_nonce bytea not null,
  key_version integer not null default 1,
  cipher_version integer not null default 1,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ov_vaults_kdf_ok check (kdf_algorithm in ('argon2id')),
  constraint ov_vaults_kdf_params_obj check (jsonb_typeof(kdf_params) = 'object'),
  constraint ov_vaults_settings_obj check (jsonb_typeof(settings) = 'object'),
  constraint ov_vaults_key_version_ok check (key_version > 0),
  constraint ov_vaults_cipher_version_ok check (cipher_version > 0),
  constraint ov_vaults_salt_len check (octet_length(kdf_salt) >= 16),
  constraint ov_vaults_wrap_nonce_len check (octet_length(wrap_nonce) >= 12),
  constraint ov_vaults_verifier_nonce_len check (octet_length(verifier_nonce) >= 12)
);

-- payload_ciphertext decrypts to the full flexible item document:
-- {name, username, password, website, note, customFields, ...futureFields}
create table if not exists ov_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'login',
  favorite boolean not null default false,
  color text,
  payload_ciphertext bytea not null,
  payload_nonce bytea not null,
  payload_schema_version integer not null default 1,
  key_version integer not null default 1,
  -- Client-generated keyed hashes; never hash low-entropy secrets directly.
  dedupe_blind_index bytea,
  name_sort_blind_index bytea,
  source_created_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ov_items_kind_len check (char_length(kind) between 1 and 40),
  constraint ov_items_color_len check (color is null or char_length(color) <= 32),
  constraint ov_items_ciphertext_len check (octet_length(payload_ciphertext) >= 16),
  constraint ov_items_nonce_len check (octet_length(payload_nonce) >= 12),
  constraint ov_items_schema_version_ok check (payload_schema_version > 0),
  constraint ov_items_key_version_ok check (key_version > 0),
  unique (user_id, id)
);

create index if not exists ov_items_user_updated_idx
  on ov_items (user_id, updated_at desc)
  where deleted_at is null;
create index if not exists ov_items_user_kind_idx
  on ov_items (user_id, kind, updated_at desc)
  where deleted_at is null;
create index if not exists ov_items_user_favorite_idx
  on ov_items (user_id, updated_at desc)
  where favorite and deleted_at is null;
create index if not exists ov_items_user_deleted_idx
  on ov_items (user_id, deleted_at desc)
  where deleted_at is not null;
create index if not exists ov_items_user_dedupe_idx
  on ov_items (user_id, dedupe_blind_index)
  where dedupe_blind_index is not null and deleted_at is null;

-- Tag names are encrypted. name_blind_index supports client-generated exact
-- duplicate detection without exposing the tag text.
create table if not exists ov_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name_ciphertext bytea not null,
  name_nonce bytea not null,
  name_blind_index bytea,
  color text,
  key_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ov_tags_ciphertext_len check (octet_length(name_ciphertext) >= 16),
  constraint ov_tags_nonce_len check (octet_length(name_nonce) >= 12),
  constraint ov_tags_color_len check (color is null or char_length(color) <= 32),
  constraint ov_tags_key_version_ok check (key_version > 0),
  unique (user_id, id)
);

create index if not exists ov_tags_user_idx on ov_tags (user_id, updated_at desc);
create index if not exists ov_tags_user_name_idx
  on ov_tags (user_id, name_blind_index)
  where name_blind_index is not null;

create table if not exists ov_item_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id, tag_id),
  foreign key (user_id, item_id)
    references ov_items(user_id, id) on delete cascade,
  foreign key (user_id, tag_id)
    references ov_tags(user_id, id) on delete cascade
);

create index if not exists ov_item_tags_user_tag_idx
  on ov_item_tags (user_id, tag_id, item_id);

-- Append-only audit records. encrypted_snapshot can contain the prior item
-- document, enabling a future "restore this version" feature without exposing
-- historical secrets to Supabase.
create table if not exists ov_item_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null,
  action text not null,
  source text not null default 'manual',
  changed_fields text[] not null default '{}'::text[],
  snapshot_ciphertext bytea,
  snapshot_nonce bytea,
  key_version integer not null default 1,
  created_at timestamptz not null default now(),
  foreign key (user_id, item_id)
    references ov_items(user_id, id) on delete cascade,
  constraint ov_item_history_action_ok
    check (action in ('created', 'updated', 'deleted', 'restored', 'imported')),
  constraint ov_item_history_source_ok
    check (source in ('manual', 'import', 'system')),
  constraint ov_item_history_snapshot_shape check (
    (snapshot_ciphertext is null and snapshot_nonce is null)
    or (
      snapshot_ciphertext is not null
      and snapshot_nonce is not null
      and octet_length(snapshot_ciphertext) >= 16
      and octet_length(snapshot_nonce) >= 12
    )
  ),
  constraint ov_item_history_key_version_ok check (key_version > 0)
);

create index if not exists ov_item_history_user_item_idx
  on ov_item_history (user_id, item_id, created_at desc);

-- Keep timestamps accurate and prevent ownership reassignment.
drop trigger if exists ov_vaults_set_updated_at on ov_vaults;
create trigger ov_vaults_set_updated_at
before update on ov_vaults
for each row execute function ov_set_updated_at();

drop trigger if exists ov_items_set_updated_at on ov_items;
create trigger ov_items_set_updated_at
before update on ov_items
for each row execute function ov_set_updated_at();

drop trigger if exists ov_tags_set_updated_at on ov_tags;
create trigger ov_tags_set_updated_at
before update on ov_tags
for each row execute function ov_set_updated_at();

drop trigger if exists ov_vaults_reject_user_change on ov_vaults;
create trigger ov_vaults_reject_user_change
before update on ov_vaults
for each row execute function ov_reject_user_id_change();

drop trigger if exists ov_items_reject_user_change on ov_items;
create trigger ov_items_reject_user_change
before update on ov_items
for each row execute function ov_reject_user_id_change();

drop trigger if exists ov_tags_reject_user_change on ov_tags;
create trigger ov_tags_reject_user_change
before update on ov_tags
for each row execute function ov_reject_user_id_change();

-- RLS: every row is private to its authenticated owner.
alter table ov_vaults enable row level security;
alter table ov_items enable row level security;
alter table ov_tags enable row level security;
alter table ov_item_tags enable row level security;
alter table ov_item_history enable row level security;

drop policy if exists ov_vaults_owner_all on ov_vaults;
create policy ov_vaults_owner_all on ov_vaults
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists ov_items_owner_all on ov_items;
create policy ov_items_owner_all on ov_items
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists ov_tags_owner_all on ov_tags;
create policy ov_tags_owner_all on ov_tags
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists ov_item_tags_owner_all on ov_item_tags;
create policy ov_item_tags_owner_all on ov_item_tags
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists ov_item_history_owner_all on ov_item_history;
drop policy if exists ov_item_history_owner_select on ov_item_history;
drop policy if exists ov_item_history_owner_insert on ov_item_history;
drop policy if exists ov_item_history_owner_delete on ov_item_history;
create policy ov_item_history_owner_select on ov_item_history
for select to authenticated
using (auth.uid() = user_id);
create policy ov_item_history_owner_insert on ov_item_history
for insert to authenticated
with check (auth.uid() = user_id);
create policy ov_item_history_owner_delete on ov_item_history
for delete to authenticated
using (auth.uid() = user_id)
;

revoke all on ov_vaults, ov_items, ov_tags, ov_item_tags, ov_item_history from anon;
grant select, insert, update, delete
  on ov_vaults, ov_items, ov_tags, ov_item_tags
  to authenticated;
grant select, insert, delete on ov_item_history to authenticated;

