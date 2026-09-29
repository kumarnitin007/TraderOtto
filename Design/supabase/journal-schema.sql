-- Otto Journal — run once in the Supabase SQL editor as postgres.
-- Entries and notes are private per user.

create extension if not exists "pgcrypto";

create or replace function jn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists jn_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  body text not null,
  entry_date date not null,
  prompt text not null default '',
  tags text[] not null default '{}',
  pinned boolean not null default false,
  favorite boolean not null default false,
  sort_order integer not null default 0,
  source_type text,
  source_id text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jn_entries_kind_ok check (kind in ('entry', 'note')),
  constraint jn_entries_body_len check (char_length(body) between 1 and 8000)
);

create index if not exists jn_entries_user_idx
  on jn_entries (user_id, entry_date desc)
  where deleted_at is null;

create unique index if not exists jn_entries_book_once
  on jn_entries (user_id, source_id)
  where source_type = 'book' and deleted_at is null;

drop trigger if exists jn_entries_set_updated_at on jn_entries;
create trigger jn_entries_set_updated_at
before update on jn_entries
for each row execute function jn_set_updated_at();

alter table jn_entries enable row level security;

drop policy if exists "jn_entries_select_own" on jn_entries;
create policy "jn_entries_select_own" on jn_entries
for select using (auth.uid() = user_id);
drop policy if exists "jn_entries_insert_own" on jn_entries;
create policy "jn_entries_insert_own" on jn_entries
for insert with check (auth.uid() = user_id);
drop policy if exists "jn_entries_update_own" on jn_entries;
create policy "jn_entries_update_own" on jn_entries
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "jn_entries_delete_own" on jn_entries;
create policy "jn_entries_delete_own" on jn_entries
for delete using (auth.uid() = user_id);
