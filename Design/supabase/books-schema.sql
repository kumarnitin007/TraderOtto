-- Otto Books — run once in the Supabase SQL editor as postgres.
-- Books are private per user and protected with row-level security.

create extension if not exists "pgcrypto";

create or replace function bk_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function bk_reject_user_id_change()
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

create table if not exists bk_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text not null,
  status text not null default 'want_to_read',
  progress_percent integer not null default 0,
  rating numeric(2,1) not null default 0,
  would_recommend boolean,
  format text not null default 'print',
  page_count integer,
  duration_minutes integer,
  started_at date,
  finished_at date,
  notes text not null default '',
  tags jsonb not null default '[]'::jsonb,
  series_title text,
  series_index numeric(6,2),
  isbn text,
  open_library_id text,
  cover_id integer,
  cover_color text not null default '#4d8069',
  meta jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bk_books_title_len check (char_length(btrim(title)) between 1 and 240),
  constraint bk_books_author_len check (char_length(btrim(author)) between 1 and 180),
  constraint bk_books_status_ok check (status in ('reading', 'read', 'want_to_read')),
  constraint bk_books_progress_ok check (progress_percent between 0 and 100),
  constraint bk_books_rating_ok check (rating between 0 and 5 and mod(rating * 2, 1) = 0),
  constraint bk_books_format_ok check (format in ('print', 'ebook', 'audiobook', 'other')),
  constraint bk_books_page_count_ok check (page_count is null or page_count > 0),
  constraint bk_books_duration_ok check (duration_minutes is null or duration_minutes > 0),
  constraint bk_books_cover_id_ok check (cover_id is null or cover_id > 0),
  constraint bk_books_tags_array check (jsonb_typeof(tags) = 'array'),
  constraint bk_books_meta_obj check (jsonb_typeof(meta) = 'object')
);

-- Safe upgrades when this file is re-run against an existing Books install.
alter table bk_books add column if not exists isbn text;
alter table bk_books add column if not exists open_library_id text;
alter table bk_books add column if not exists cover_id integer;

create index if not exists bk_books_user_status_idx
  on bk_books (user_id, status, updated_at desc)
  where deleted_at is null;
create index if not exists bk_books_user_finished_idx
  on bk_books (user_id, finished_at desc)
  where status = 'read' and deleted_at is null;

drop trigger if exists bk_books_updated_at on bk_books;
create trigger bk_books_updated_at
before update on bk_books
for each row execute function bk_set_updated_at();

drop trigger if exists bk_books_reject_user_change on bk_books;
create trigger bk_books_reject_user_change
before update on bk_books
for each row execute function bk_reject_user_id_change();

alter table bk_books enable row level security;

drop policy if exists "bk_books_select_own" on bk_books;
create policy "bk_books_select_own" on bk_books
for select using (auth.uid() = user_id);
drop policy if exists "bk_books_insert_own" on bk_books;
create policy "bk_books_insert_own" on bk_books
for insert with check (auth.uid() = user_id);
drop policy if exists "bk_books_update_own" on bk_books;
create policy "bk_books_update_own" on bk_books
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "bk_books_delete_own" on bk_books;
create policy "bk_books_delete_own" on bk_books
for delete using (auth.uid() = user_id);

create table if not exists bk_discovery_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report jsonb not null,
  model text not null,
  created_at timestamptz not null default now(),
  constraint bk_discovery_report_obj check (jsonb_typeof(report) = 'object'),
  constraint bk_discovery_model_len check (char_length(model) between 1 and 120)
);

create index if not exists bk_discovery_user_created_idx
  on bk_discovery_reports (user_id, created_at desc);

alter table bk_discovery_reports enable row level security;

drop policy if exists "bk_discovery_select_own" on bk_discovery_reports;
create policy "bk_discovery_select_own" on bk_discovery_reports
for select using (auth.uid() = user_id);
drop policy if exists "bk_discovery_insert_own" on bk_discovery_reports;
create policy "bk_discovery_insert_own" on bk_discovery_reports
for insert with check (auth.uid() = user_id);
drop policy if exists "bk_discovery_delete_own" on bk_discovery_reports;
create policy "bk_discovery_delete_own" on bk_discovery_reports
for delete using (auth.uid() = user_id);
