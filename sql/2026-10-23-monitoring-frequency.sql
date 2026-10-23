-- Apply in Supabase SQL Editor before selecting a custom frequency.
-- Existing organizations default to three-hour monitoring.
alter table public.organization_notification_settings
  add column if not exists monitoring_interval_hours integer not null default 3
  check (monitoring_interval_hours in (1,3,6,12));
