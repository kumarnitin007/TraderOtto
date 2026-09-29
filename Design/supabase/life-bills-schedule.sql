-- Add bill schedules to an existing lf_bills table.
-- Paste this whole file into the Supabase SQL editor. Do not paste a folded preview.

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
