-- Otto Banks — paste this entire file into the Supabase SQL editor.
-- Accounts and deposits are private per user. No spreadsheet rows are included.

create or replace function nw_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists nw_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country text not null default 'us',
  kind text not null default 'checking',
  institution text not null,
  nickname text not null default '',
  owner_name text not null default '',
  currency text not null default 'USD',
  balance numeric not null default 0,
  last4 text not null default '',
  account_number text not null default '',
  routing text not null default '',
  nominee text not null default '',
  notes text not null default '',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nw_accounts_country_ok check (country in ('us', 'in')),
  constraint nw_accounts_kind_ok check (kind in ('checking', 'savings', 'trading', 'card', 'loan')),
  constraint nw_accounts_currency_ok check (currency in ('USD', 'INR')),
  constraint nw_accounts_name_len check (char_length(institution) between 1 and 80)
);

create table if not exists nw_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country text not null default 'in',
  kind text not null default 'fd',
  institution text not null,
  nickname text not null default '',
  owner_name text not null default '',
  currency text not null default 'INR',
  principal numeric not null default 0,
  rate numeric,
  payout text not null default 'quarterly',
  started_on date,
  matures_on date,
  renew text not null default 'close',
  nominee text not null default '',
  notes text not null default '',
  closed boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nw_deposits_country_ok check (country in ('us', 'in')),
  constraint nw_deposits_kind_ok check (kind in ('cd', 'fd', 'rd', 'ppf', 'scss', 'po', 'other')),
  constraint nw_deposits_currency_ok check (currency in ('USD', 'INR')),
  constraint nw_deposits_payout_ok check (payout in ('maturity', 'monthly', 'quarterly')),
  constraint nw_deposits_renew_ok check (renew in ('close', 'auto')),
  constraint nw_deposits_name_len check (char_length(institution) between 1 and 80)
);

create index if not exists nw_accounts_user_idx on nw_accounts (user_id) where deleted_at is null;
create index if not exists nw_deposits_user_idx on nw_deposits (user_id, matures_on) where deleted_at is null;

drop trigger if exists nw_accounts_set_updated_at on nw_accounts;
create trigger nw_accounts_set_updated_at
before update on nw_accounts
for each row execute function nw_set_updated_at();

drop trigger if exists nw_deposits_set_updated_at on nw_deposits;
create trigger nw_deposits_set_updated_at
before update on nw_deposits
for each row execute function nw_set_updated_at();

alter table nw_accounts enable row level security;
alter table nw_deposits enable row level security;

drop policy if exists "nw_accounts_own" on nw_accounts;
create policy "nw_accounts_own" on nw_accounts
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "nw_deposits_own" on nw_deposits;
create policy "nw_deposits_own" on nw_deposits
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
