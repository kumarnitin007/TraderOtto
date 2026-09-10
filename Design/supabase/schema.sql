-- Trader Otto — final-state Supabase schema
-- Not needed for Phase 1 (local cache). Run this when migrating to Phase 2.

create extension if not exists "pgcrypto";

create table if not exists trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,

  -- trade basics
  ticker text not null,
  strategy text not null,
  contracts integer not null default 1,
  expiry date not null,
  open_date date not null,

  -- strikes (put side / primary spread)
  short_strike numeric,
  long_strike numeric,
  -- strikes (call side, only populated for Iron Condor)
  call_short_strike numeric,
  call_long_strike numeric,

  -- market snapshot at open
  stock_price_open numeric,
  iv numeric,
  delta numeric,
  sigma numeric,
  theta numeric,

  -- premium + status
  premium_open numeric not null,
  status text not null default 'open' check (status in ('open', 'closed')),

  -- close-out fields (null until closed)
  close_date date,
  stock_price_close numeric,
  premium_close numeric,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trades_user_id_idx on trades (user_id);
create index if not exists trades_status_idx on trades (status);
create index if not exists trades_close_date_idx on trades (close_date);

-- keep updated_at current
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trades_set_updated_at on trades;
create trigger trades_set_updated_at
  before update on trades
  for each row execute function set_updated_at();

-- row level security: each user only ever sees their own trades
alter table trades enable row level security;

create policy "select own trades" on trades
  for select using (auth.uid() = user_id);

create policy "insert own trades" on trades
  for insert with check (auth.uid() = user_id);

create policy "update own trades" on trades
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete own trades" on trades
  for delete using (auth.uid() = user_id);
