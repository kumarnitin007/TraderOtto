-- Otto Life — run once in the Supabase SQL editor as postgres.
-- Dates are private per user and protected with row-level security.

create extension if not exists "pgcrypto";

create or replace function lf_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function lf_reject_user_id_change()
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

create table if not exists lf_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  notes text not null default '',
  month integer not null,
  day integer not null,
  year integer,
  occurs_on date,
  repeats text not null default 'yearly',
  remind_days integer not null default 3,
  milestone boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lf_items_name_len check (char_length(name) between 1 and 160),
  constraint lf_items_category_ok check (category in ('birthday', 'anniversary', 'holiday', 'special', 'other')),
  constraint lf_items_month_ok check (month between 1 and 12),
  constraint lf_items_day_ok check (day between 1 and 31),
  constraint lf_items_repeats_ok check (repeats in ('yearly', 'once')),
  constraint lf_items_remind_ok check (remind_days between 0 and 30)
);

create index if not exists lf_items_user_idx
  on lf_items (user_id, month, day)
  where deleted_at is null;

drop trigger if exists lf_items_set_updated_at on lf_items;
create trigger lf_items_set_updated_at
before update on lf_items
for each row execute function lf_set_updated_at();

drop trigger if exists lf_items_reject_user_id_change on lf_items;
create trigger lf_items_reject_user_id_change
before update on lf_items
for each row execute function lf_reject_user_id_change();

alter table lf_items enable row level security;

drop policy if exists "lf_items_select_own" on lf_items;
create policy "lf_items_select_own" on lf_items
for select using (auth.uid() = user_id);
drop policy if exists "lf_items_insert_own" on lf_items;
create policy "lf_items_insert_own" on lf_items
for insert with check (auth.uid() = user_id);
drop policy if exists "lf_items_update_own" on lf_items;
create policy "lf_items_update_own" on lf_items
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "lf_items_delete_own" on lf_items;
create policy "lf_items_delete_own" on lf_items
for delete using (auth.uid() = user_id);

-- Tracked habits. Re-run this script if Life dates already exist.

create table if not exists lf_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text not null default '',
  cadence text not null default 'daily',
  target_count integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lf_tasks_name_len check (char_length(name) between 1 and 160),
  constraint lf_tasks_cadence_ok check (cadence in ('daily', 'weekly')),
  constraint lf_tasks_target_ok check (target_count between 1 and 14)
);

create index if not exists lf_tasks_user_idx
  on lf_tasks (user_id, created_at)
  where deleted_at is null;

drop trigger if exists lf_tasks_set_updated_at on lf_tasks;
create trigger lf_tasks_set_updated_at
before update on lf_tasks
for each row execute function lf_set_updated_at();

drop trigger if exists lf_tasks_reject_user_id_change on lf_tasks;
create trigger lf_tasks_reject_user_id_change
before update on lf_tasks
for each row execute function lf_reject_user_id_change();

alter table lf_tasks enable row level security;

drop policy if exists "lf_tasks_select_own" on lf_tasks;
create policy "lf_tasks_select_own" on lf_tasks
for select using (auth.uid() = user_id);
drop policy if exists "lf_tasks_insert_own" on lf_tasks;
create policy "lf_tasks_insert_own" on lf_tasks
for insert with check (auth.uid() = user_id);
drop policy if exists "lf_tasks_update_own" on lf_tasks;
create policy "lf_tasks_update_own" on lf_tasks
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "lf_tasks_delete_own" on lf_tasks;
create policy "lf_tasks_delete_own" on lf_tasks
for delete using (auth.uid() = user_id);

create table if not exists lf_task_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references lf_tasks(id) on delete cascade,
  done_on date not null,
  created_at timestamptz not null default now(),
  unique (task_id, done_on)
);

create index if not exists lf_task_checks_user_day_idx
  on lf_task_checks (user_id, done_on desc);

alter table lf_task_checks enable row level security;

drop policy if exists "lf_task_checks_select_own" on lf_task_checks;
create policy "lf_task_checks_select_own" on lf_task_checks
for select using (auth.uid() = user_id);
drop policy if exists "lf_task_checks_insert_own" on lf_task_checks;
create policy "lf_task_checks_insert_own" on lf_task_checks
for insert with check (auth.uid() = user_id);
drop policy if exists "lf_task_checks_delete_own" on lf_task_checks;
create policy "lf_task_checks_delete_own" on lf_task_checks
for delete using (auth.uid() = user_id);
