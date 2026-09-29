-- Otto Life bills — paste this entire file into the Supabase SQL editor.
-- A folded preview that contains "[6 lines collapsed]" is not SQL and will fail.

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

alter table lf_bills add column if not exists frequency text not null default 'monthly';
alter table lf_bills add column if not exists due_month integer;
alter table lf_bills add column if not exists due_day_2 integer;
alter table lf_bills add column if not exists due_set boolean not null default true;

alter table lf_bills drop constraint if exists lf_bills_frequency_ok;
alter table lf_bills add constraint lf_bills_frequency_ok
  check (frequency in ('monthly', 'semimonthly', 'bimonthly', 'yearly'));
alter table lf_bills drop constraint if exists lf_bills_due_day_2_ok;
alter table lf_bills add constraint lf_bills_due_day_2_ok
  check (due_day_2 is null or due_day_2 between 1 and 31);
alter table lf_bills drop constraint if exists lf_bills_due_month_ok;
alter table lf_bills add constraint lf_bills_due_month_ok
  check (due_month is null or due_month between 1 and 12);

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
