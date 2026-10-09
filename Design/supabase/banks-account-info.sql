-- Otto Banks — paste this into the Supabase SQL editor if accounts already exist.
-- Adds the full account number and the routing number or IFSC. Safe to run more than once.

alter table nw_accounts add column if not exists account_number text not null default '';
alter table nw_accounts add column if not exists routing text not null default '';
