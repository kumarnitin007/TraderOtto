-- Otto User Screens — run once in Supabase SQL editor as postgres.
-- Two generic tables support every user-created screen; creating a screen never creates a table.

begin;

create table if not exists public.us_custom_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  position smallint not null default 0,
  columns jsonb not null default '[]'::jsonb
    check (jsonb_typeof(columns) = 'array' and jsonb_array_length(columns) between 1 and 20),
  -- {"items":[{"by":"<text column id>","sum":"<number or formula id>"}]}.
  -- Older rows may still be {"by":"...","sum":"..."}. Both are objects, so no migration is required.
  summary jsonb check (summary is null or jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists us_custom_lists_user_idx
  on public.us_custom_lists (user_id, position, created_at);

create table if not exists public.us_custom_list_rows (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.us_custom_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists us_custom_list_rows_list_idx
  on public.us_custom_list_rows (list_id, created_at);
create index if not exists us_custom_list_rows_user_idx
  on public.us_custom_list_rows (user_id);

create or replace function public.us_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists us_custom_lists_updated_at on public.us_custom_lists;
create trigger us_custom_lists_updated_at
  before update on public.us_custom_lists
  for each row execute function public.us_set_updated_at();

drop trigger if exists us_custom_list_rows_updated_at on public.us_custom_list_rows;
create trigger us_custom_list_rows_updated_at
  before update on public.us_custom_list_rows
  for each row execute function public.us_set_updated_at();

create or replace function public.us_custom_lists_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
    if (select count(*) from public.us_custom_lists where user_id = new.user_id) >= 4 then
      raise exception 'LIST_LIMIT_REACHED: at most 4 custom screens per user';
    end if;
  elsif new.user_id <> old.user_id then
    raise exception 'user_id cannot be changed';
  end if;
  return new;
end $$;

drop trigger if exists us_custom_lists_guard_trg on public.us_custom_lists;
create trigger us_custom_lists_guard_trg
  before insert or update on public.us_custom_lists
  for each row execute function public.us_custom_lists_guard();

create or replace function public.us_custom_list_rows_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(new.list_id::text, 0));
    if not exists (
      select 1 from public.us_custom_lists
      where id = new.list_id and user_id = new.user_id
    ) then
      raise exception 'List not found for this user';
    end if;
    if (select count(*) from public.us_custom_list_rows where list_id = new.list_id) >= 5000 then
      raise exception 'ROW_LIMIT_REACHED: at most 5000 rows per screen';
    end if;
  elsif new.list_id <> old.list_id or new.user_id <> old.user_id then
    raise exception 'list_id and user_id cannot be changed';
  end if;
  return new;
end $$;

drop trigger if exists us_custom_list_rows_guard_trg on public.us_custom_list_rows;
create trigger us_custom_list_rows_guard_trg
  before insert or update on public.us_custom_list_rows
  for each row execute function public.us_custom_list_rows_guard();

alter table public.us_custom_lists enable row level security;
alter table public.us_custom_list_rows enable row level security;

drop policy if exists us_custom_lists_own on public.us_custom_lists;
create policy us_custom_lists_own on public.us_custom_lists
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists us_custom_list_rows_own on public.us_custom_list_rows;
create policy us_custom_list_rows_own on public.us_custom_list_rows
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.us_custom_lists, public.us_custom_list_rows from anon;
grant select, insert, update, delete
  on public.us_custom_lists, public.us_custom_list_rows
  to authenticated;

commit;
