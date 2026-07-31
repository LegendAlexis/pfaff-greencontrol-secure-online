-- DRAFT ONLY - DO NOT RUN AGAINST PRODUCTION.
-- C2 review artifact. Apply only to the isolated GreenControl Staging project
-- after explicit approval and an identity-gated preflight.

begin;

create table public.device_commands (
  id uuid primary key default gen_random_uuid(),
  protocol_version smallint not null default 1,
  device_id uuid not null
    references public.devices(id) on delete restrict,
  actuator text not null,
  command text not null,
  sequence bigint generated always as identity,
  payload jsonb not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  delivered_at timestamptz null,
  acknowledged_at timestamptz null,
  ack_reason text null,
  actual_state jsonb null,

  constraint device_commands_protocol_version_check
    check (protocol_version = 1),
  constraint device_commands_actuator_check
    check (actuator in ('watering', 'roof_window', 'side_window')),
  constraint device_commands_type_check
    check (
      (actuator = 'watering' and command = 'set') or
      (
        actuator in ('roof_window', 'side_window') and
        command = 'move'
      )
    ),
  constraint device_commands_payload_check
    check (
      (
        actuator = 'watering' and
        jsonb_typeof(payload) = 'object' and
        payload ? 'state' and
        payload->>'state' in ('on', 'off') and
        payload - 'state' = '{}'::jsonb
      ) or
      (
        actuator in ('roof_window', 'side_window') and
        jsonb_typeof(payload) = 'object' and
        payload ? 'action' and
        payload->>'action' in ('open', 'stop', 'close') and
        payload - 'action' = '{}'::jsonb
      )
    ),
  constraint device_commands_status_check
    check (
      status in (
        'pending',
        'delivered',
        'applied',
        'already_applied',
        'rejected',
        'expired',
        'superseded',
        'unsupported',
        'failed'
      )
    ),
  constraint device_commands_expiry_check
    check (expires_at > created_at),
  constraint device_commands_device_actuator_sequence_key
    unique (device_id, actuator, sequence)
);

create index device_commands_poll_idx
  on public.device_commands (device_id, sequence)
  where status in ('pending', 'delivered');

alter table public.device_commands enable row level security;

revoke all privileges on table public.device_commands
  from public, anon, authenticated;
revoke all privileges on sequence public.device_commands_sequence_seq
  from public, anon, authenticated;

grant select, insert, update, delete on table public.device_commands
  to service_role;
grant usage, select, update on sequence public.device_commands_sequence_seq
  to service_role;

commit;
