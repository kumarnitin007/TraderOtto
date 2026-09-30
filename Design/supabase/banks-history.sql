-- Run this if Banks tables already exist. It stores each balance change for growth.

create table if not exists nw_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  holding_kind text not null,
  holding_id uuid not null,
  amount numeric not null,
  currency text not null,
  recorded_on date not null default current_date,
  created_at timestamptz not null default now(),
  constraint nw_snapshots_kind_ok check (holding_kind in ('account', 'deposit')),
  constraint nw_snapshots_currency_ok check (currency in ('USD', 'INR'))
);

create index if not exists nw_snapshots_user_idx on nw_snapshots (user_id, recorded_on);

alter table nw_snapshots enable row level security;

drop policy if exists "nw_snapshots_own" on nw_snapshots;
create policy "nw_snapshots_own" on nw_snapshots
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
