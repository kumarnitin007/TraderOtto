-- Otto Life bills — run once in the Supabase SQL editor as postgres.

create table if not exists lf_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric,
  due_day integer not null,
  category text not null default 'other',
  paid_month text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lf_bills_name_len check (char_length(name) between 1 and 80),
  constraint lf_bills_due_ok check (due_day between 1 and 31),
  constraint lf_bills_category_ok check (
    category in ('water', 'electric', 'credit_card', 'mortgage', 'other')
  )
);

create index if not exists lf_bills_user_idx
  on lf_bills (user_id, due_day)
  where deleted_at is null;

drop trigger if exists lf_bills_set_updated_at on lf_bills;
create trigger lf_bills_set_updated_at
before update on lf_bills
for each row execute function lf_set_updated_at();

alter table lf_bills enable row level security;

drop policy if exists "lf_bills_select_own" on lf_bills;
create policy "lf_bills_select_own" on lf_bills
for select using (auth.uid() = user_id);
drop policy if exists "lf_bills_insert_own" on lf_bills;
create policy "lf_bills_insert_own" on lf_bills
for insert with check (auth.uid() = user_id);
drop policy if exists "lf_bills_update_own" on lf_bills;
create policy "lf_bills_update_own" on lf_bills
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "lf_bills_delete_own" on lf_bills;
create policy "lf_bills_delete_own" on lf_bills
for delete using (auth.uid() = user_id);
