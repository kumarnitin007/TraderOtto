-- =============================================================================
-- Trader Otto — run once in Supabase SQL editor (role: postgres)
-- Prefix is tr_ (lowercase). Do not quote TR_.
--
-- Expansion columns on every table (avoid later migrations):
--   meta        jsonb          app-defined extras
--   deleted_at  timestamptz    soft delete (null = live)
-- =============================================================================

create extension if not exists "pgcrypto";

create or replace function tr_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function tr_reject_user_id_change()
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

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists tr_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  avatar_emoji text,
  settings jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tr_profiles_settings_obj check (jsonb_typeof(settings) = 'object'),
  constraint tr_profiles_meta_obj check (jsonb_typeof(meta) = 'object'),
  constraint tr_profiles_name_len check (display_name is null or char_length(display_name) between 1 and 80)
);

-- ---------------------------------------------------------------------------
-- Trades  (Performance = closed rows, computed on read)
-- ---------------------------------------------------------------------------
create table if not exists tr_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  strategy text not null,
  status text not null default 'open',
  contracts integer not null default 1,
  expiry date not null,
  open_date date not null,
  close_date date,
  premium_open numeric not null,
  premium_close numeric,
  pnl numeric,
  details jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tr_trades_status_ok check (status in ('open', 'closed')),
  constraint tr_trades_ticker_ok check (ticker = upper(ticker) and ticker ~ '^[A-Z][A-Z0-9.-]{0,9}$'),
  constraint tr_trades_contracts_ok check (contracts > 0 and contracts <= 10000),
  constraint tr_trades_strategy_len check (char_length(strategy) between 1 and 80),
  constraint tr_trades_close_shape check (
    (status = 'open' and close_date is null and premium_close is null)
    or (status = 'closed' and close_date is not null)
  ),
  constraint tr_trades_dates_ok check (close_date is null or close_date >= open_date),
  constraint tr_trades_details_obj check (jsonb_typeof(details) = 'object'),
  constraint tr_trades_meta_obj check (jsonb_typeof(meta) = 'object')
);

create index if not exists tr_trades_user_status_idx
  on tr_trades (user_id, status, open_date desc)
  where deleted_at is null;
create index if not exists tr_trades_user_ticker_idx
  on tr_trades (user_id, ticker)
  where deleted_at is null;
create index if not exists tr_trades_user_close_idx
  on tr_trades (user_id, close_date desc)
  where status = 'closed' and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Watch groups
-- private = owner only; unlisted = owner only for now; public = catalog + copy
-- ---------------------------------------------------------------------------
create table if not exists tr_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  visibility text not null default 'private',
  source_group_id uuid references tr_groups(id) on delete set null,
  tickers jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tr_groups_visibility_ok check (visibility in ('private', 'unlisted', 'public')),
  constraint tr_groups_name_len check (char_length(btrim(name)) between 1 and 80),
  constraint tr_groups_tickers_arr check (jsonb_typeof(tickers) = 'array'),
  constraint tr_groups_meta_obj check (jsonb_typeof(meta) = 'object'),
  constraint tr_groups_not_copy_of_self check (source_group_id is distinct from id)
);

create index if not exists tr_groups_user_idx
  on tr_groups (user_id, updated_at desc)
  where deleted_at is null;
create index if not exists tr_groups_public_idx
  on tr_groups (updated_at desc)
  where visibility = 'public' and deleted_at is null;
create index if not exists tr_groups_tickers_gin
  on tr_groups using gin (tickers jsonb_path_ops);

-- ---------------------------------------------------------------------------
-- Per-user ticker poll prefs
-- ---------------------------------------------------------------------------
create table if not exists tr_ticker_prefs (
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  poll_mode text not null default 'normal',
  poll_open_ms integer,
  poll_closed_ms integer,
  extras jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, ticker),
  constraint tr_ticker_prefs_ticker_ok check (ticker = upper(ticker) and ticker ~ '^[A-Z][A-Z0-9.-]{0,9}$'),
  constraint tr_ticker_prefs_mode_ok check (poll_mode in ('live', 'normal', 'low')),
  constraint tr_ticker_prefs_open_ms_ok check (poll_open_ms is null or poll_open_ms between 1000 and 3600000),
  constraint tr_ticker_prefs_closed_ms_ok check (poll_closed_ms is null or poll_closed_ms between 5000 and 86400000),
  constraint tr_ticker_prefs_extras_obj check (jsonb_typeof(extras) = 'object'),
  constraint tr_ticker_prefs_meta_obj check (jsonb_typeof(meta) = 'object')
);

create index if not exists tr_ticker_prefs_user_mode_idx
  on tr_ticker_prefs (user_id, poll_mode)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Formulas
-- ---------------------------------------------------------------------------
create table if not exists tr_formulas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  slug text not null,
  name text not null,
  version integer not null default 1,
  is_system boolean not null default false,
  spec jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tr_formulas_slug_ok check (slug ~ '^[a-z0-9-]{1,64}$'),
  constraint tr_formulas_name_len check (char_length(name) between 1 and 80),
  constraint tr_formulas_version_ok check (version >= 1),
  constraint tr_formulas_system_owner check (
    (is_system and user_id is null) or (not is_system and user_id is not null)
  ),
  constraint tr_formulas_spec_obj check (jsonb_typeof(spec) = 'object'),
  constraint tr_formulas_meta_obj check (jsonb_typeof(meta) = 'object')
);

create unique index if not exists tr_formulas_owner_slug_version_idx
  on tr_formulas (
    (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    slug,
    version
  )
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Signals
-- ---------------------------------------------------------------------------
create table if not exists tr_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  formula_id uuid references tr_formulas(id) on delete set null,
  kind text not null,
  status text not null default 'open',
  ticker text,
  trade_id uuid references tr_trades(id) on delete cascade,
  group_id uuid references tr_groups(id) on delete cascade,
  fired_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint tr_signals_status_ok check (status in ('open', 'acked', 'expired')),
  constraint tr_signals_kind_len check (char_length(kind) between 1 and 40),
  constraint tr_signals_ticker_ok check (
    ticker is null or (ticker = upper(ticker) and ticker ~ '^[A-Z][A-Z0-9.-]{0,9}$')
  ),
  constraint tr_signals_payload_obj check (jsonb_typeof(payload) = 'object'),
  constraint tr_signals_meta_obj check (jsonb_typeof(meta) = 'object')
);

create index if not exists tr_signals_user_status_idx
  on tr_signals (user_id, status, fired_at desc)
  where deleted_at is null;
create index if not exists tr_signals_user_ticker_idx
  on tr_signals (user_id, ticker, fired_at desc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Market cache (writes via service role)
-- ---------------------------------------------------------------------------
create table if not exists tr_snapshots (
  symbol text not null,
  kind text not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  body jsonb not null,
  meta jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  primary key (symbol, kind),
  constraint tr_snapshots_symbol_ok check (symbol = upper(symbol) and char_length(symbol) between 1 and 16),
  constraint tr_snapshots_kind_ok check (kind ~ '^[a-z0-9_]{1,40}$'),
  constraint tr_snapshots_ttl_ok check (expires_at > fetched_at),
  constraint tr_snapshots_body_ok check (jsonb_typeof(body) in ('object', 'array')),
  constraint tr_snapshots_meta_obj check (jsonb_typeof(meta) = 'object')
);

create index if not exists tr_snapshots_expires_idx
  on tr_snapshots (expires_at)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- External API tracking (do NOT log high-frequency quotes as events)
-- tr_api_usage  = 1 row per user/provider/kind/day  (Alpaca/Finnhub poll counts)
-- tr_api_events = OCR / OpenAI / Gemini / failures with captured payload
-- Purge events where expires_at < now() (default 90 days).
-- ---------------------------------------------------------------------------
create table if not exists tr_api_usage (
  user_id uuid references auth.users(id) on delete cascade,
  day date not null default ((timezone('utc', now()))::date),
  provider text not null,
  kind text not null,
  call_count integer not null default 0,
  error_count integer not null default 0,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  latency_ms_sum integer not null default 0,
  meta jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tr_api_usage_provider_ok check (provider ~ '^[a-z0-9_]{2,32}$'),
  constraint tr_api_usage_kind_ok check (kind ~ '^[a-z0-9_]{2,40}$'),
  constraint tr_api_usage_counts_ok check (
    call_count >= 0 and error_count >= 0 and tokens_in >= 0 and tokens_out >= 0
    and latency_ms_sum >= 0
  ),
  constraint tr_api_usage_meta_obj check (jsonb_typeof(meta) = 'object')
);

create unique index if not exists tr_api_usage_day_idx
  on tr_api_usage (
    (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    day,
    provider,
    kind
  )
  where deleted_at is null;

create table if not exists tr_api_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  kind text not null,
  status text not null default 'success',
  model text,
  duration_ms integer,
  tokens_in integer,
  tokens_out integer,
  trade_id uuid references tr_trades(id) on delete set null,
  captured jsonb not null default '{}'::jsonb,
  error text,
  meta jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  constraint tr_api_events_provider_ok check (provider ~ '^[a-z0-9_]{2,32}$'),
  constraint tr_api_events_kind_ok check (kind ~ '^[a-z0-9_]{2,40}$'),
  constraint tr_api_events_status_ok check (status in ('success', 'error', 'skipped')),
  constraint tr_api_events_duration_ok check (duration_ms is null or duration_ms >= 0),
  constraint tr_api_events_captured_obj check (jsonb_typeof(captured) = 'object'),
  constraint tr_api_events_meta_obj check (jsonb_typeof(meta) = 'object'),
  constraint tr_api_events_error_len check (error is null or char_length(error) <= 500)
);

-- captured examples (never store the screenshot bytes):
-- OCR: { "fields": { "ticker": "GOOGL", "premiumOpen": 1.79 }, "textPreview": "first 500 chars" }
-- OpenAI/Gemini: { "promptKind": "trade_coach", "outputPreview": "..." }

create index if not exists tr_api_events_user_idx
  on tr_api_events (user_id, created_at desc)
  where deleted_at is null;
create index if not exists tr_api_events_expires_idx
  on tr_api_events (expires_at)
  where deleted_at is null;
create index if not exists tr_api_events_provider_idx
  on tr_api_events (user_id, provider, kind, created_at desc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
drop trigger if exists tr_profiles_updated_at on tr_profiles;
create trigger tr_profiles_updated_at
  before update on tr_profiles
  for each row execute function tr_set_updated_at();

drop trigger if exists tr_trades_updated_at on tr_trades;
create trigger tr_trades_updated_at
  before update on tr_trades
  for each row execute function tr_set_updated_at();

drop trigger if exists tr_trades_user_lock on tr_trades;
create trigger tr_trades_user_lock
  before update on tr_trades
  for each row execute function tr_reject_user_id_change();

drop trigger if exists tr_groups_updated_at on tr_groups;
create trigger tr_groups_updated_at
  before update on tr_groups
  for each row execute function tr_set_updated_at();

drop trigger if exists tr_groups_user_lock on tr_groups;
create trigger tr_groups_user_lock
  before update on tr_groups
  for each row execute function tr_reject_user_id_change();

drop trigger if exists tr_ticker_prefs_updated_at on tr_ticker_prefs;
create trigger tr_ticker_prefs_updated_at
  before update on tr_ticker_prefs
  for each row execute function tr_set_updated_at();

drop trigger if exists tr_ticker_prefs_user_lock on tr_ticker_prefs;
create trigger tr_ticker_prefs_user_lock
  before update on tr_ticker_prefs
  for each row execute function tr_reject_user_id_change();

drop trigger if exists tr_formulas_updated_at on tr_formulas;
create trigger tr_formulas_updated_at
  before update on tr_formulas
  for each row execute function tr_set_updated_at();

drop trigger if exists tr_signals_user_lock on tr_signals;
create trigger tr_signals_user_lock
  before update on tr_signals
  for each row execute function tr_reject_user_id_change();

drop trigger if exists tr_api_usage_updated_at on tr_api_usage;
create trigger tr_api_usage_updated_at
  before update on tr_api_usage
  for each row execute function tr_set_updated_at();

create or replace function tr_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tr_profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists tr_on_auth_user_created on auth.users;
create trigger tr_on_auth_user_created
  after insert on auth.users
  for each row execute function tr_handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table tr_profiles enable row level security;
alter table tr_profiles force row level security;
alter table tr_trades enable row level security;
alter table tr_trades force row level security;
alter table tr_groups enable row level security;
alter table tr_groups force row level security;
alter table tr_ticker_prefs enable row level security;
alter table tr_ticker_prefs force row level security;
alter table tr_formulas enable row level security;
alter table tr_formulas force row level security;
alter table tr_signals enable row level security;
alter table tr_signals force row level security;
alter table tr_snapshots enable row level security;
alter table tr_snapshots force row level security;
alter table tr_api_usage enable row level security;
alter table tr_api_usage force row level security;
alter table tr_api_events enable row level security;
alter table tr_api_events force row level security;

drop policy if exists "tr_profiles_select" on tr_profiles;
drop policy if exists "tr_profiles_own" on tr_profiles;
drop policy if exists "tr_profiles_write" on tr_profiles;
drop policy if exists "tr_trades_own" on tr_trades;
drop policy if exists "tr_groups_own" on tr_groups;
drop policy if exists "tr_groups_read_public" on tr_groups;
drop policy if exists "tr_groups_write" on tr_groups;
drop policy if exists "tr_ticker_prefs_own" on tr_ticker_prefs;
drop policy if exists "tr_formulas_read" on tr_formulas;
drop policy if exists "tr_formulas_own_write" on tr_formulas;
drop policy if exists "tr_formulas_insert" on tr_formulas;
drop policy if exists "tr_formulas_update" on tr_formulas;
drop policy if exists "tr_formulas_delete" on tr_formulas;
drop policy if exists "tr_signals_own" on tr_signals;
drop policy if exists "tr_snapshots_read_auth" on tr_snapshots;
drop policy if exists "tr_api_usage_own" on tr_api_usage;
drop policy if exists "tr_api_events_own" on tr_api_events;

create policy "tr_profiles_select" on tr_profiles
  for select
  using (
    deleted_at is null
    and (
      auth.uid() = id
      or exists (
        select 1 from tr_groups g
        where g.user_id = tr_profiles.id
          and g.visibility = 'public'
          and g.deleted_at is null
      )
    )
  );

create policy "tr_profiles_write" on tr_profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "tr_trades_own" on tr_trades
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tr_groups_write" on tr_groups
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tr_groups_read_public" on tr_groups
  for select
  using (visibility = 'public' and deleted_at is null);

create policy "tr_ticker_prefs_own" on tr_ticker_prefs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tr_formulas_read" on tr_formulas
  for select
  using (
    deleted_at is null
    and (is_system or auth.uid() = user_id)
  );

create policy "tr_formulas_insert" on tr_formulas
  for insert
  with check (
    auth.uid() = user_id
    and is_system = false
    and user_id is not null
  );

create policy "tr_formulas_update" on tr_formulas
  for update
  using (auth.uid() = user_id and is_system = false)
  with check (auth.uid() = user_id and is_system = false);

create policy "tr_formulas_delete" on tr_formulas
  for delete
  using (auth.uid() = user_id and is_system = false);

create policy "tr_signals_own" on tr_signals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tr_snapshots_read_auth" on tr_snapshots
  for select
  using (auth.uid() is not null and deleted_at is null);

-- Users see their own counters. Platform-wide rows (user_id null) are service-role only.
create policy "tr_api_usage_own" on tr_api_usage
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tr_api_events_own" on tr_api_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on tr_profiles to authenticated;
grant select on tr_profiles to anon;

grant select, insert, update, delete on tr_trades to authenticated;
grant select, insert, update, delete on tr_groups to authenticated;
grant select on tr_groups to anon;

grant select, insert, update, delete on tr_ticker_prefs to authenticated;
grant select, insert, update, delete on tr_formulas to authenticated;
grant select, insert, update, delete on tr_signals to authenticated;
grant select on tr_snapshots to authenticated;
grant select, insert, update, delete on tr_api_usage to authenticated;
grant select, insert, update, delete on tr_api_events to authenticated;
