alter table public.incident_criteria_settings
  add column if not exists new_city_enabled boolean not null default true,
  add column if not exists new_city_points integer not null default 10;

alter table public.incident_criteria_settings
  drop constraint if exists incident_criteria_settings_new_city_points_check;

alter table public.incident_criteria_settings
  add constraint incident_criteria_settings_new_city_points_check
  check (new_city_points >= 0 and new_city_points <= 100);
