-- Canonical P0 security overlay for isolated GreenControl environments.
-- Apply only after 001_public_schema.sql and only through an identity-gated
-- database harness. This file contains no tenant or feature migration.

begin;

alter table public.manual_commands enable row level security;

revoke update on table public.profiles
  from public, anon, authenticated;

revoke all privileges on table public.manual_commands
  from public, anon, authenticated;

revoke all privileges on sequence public.manual_commands_id_seq
  from public, anon, authenticated;

-- These service_role ACLs were measured read-only in the hardened production
-- baseline. No TRUNCATE, REFERENCES or TRIGGER privilege is added.
grant select, insert, update, delete
  on table
    public.alert_states,
    public.audit_logs,
    public.devices,
    public.email_notification_log,
    public.greenhouse_users,
    public.greenhouses,
    public.manual_commands,
    public.notification_settings,
    public.profiles,
    public.sensor_readings,
    public.warning_logs,
    public.watering_schedule,
    public.weather_station
  to service_role;

grant usage, select, update
  on sequence
    public.audit_logs_id_seq,
    public.email_notification_log_id_seq,
    public.greenhouses_id_seq,
    public.manual_commands_id_seq,
    public.sensor_readings_id_seq,
    public.warning_logs_id_seq,
    public.watering_schedule_id_seq,
    public.weather_station_id_seq
  to service_role;

commit;
