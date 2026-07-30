-- REFERENCE DRAFT - DO NOT RUN WITHOUT AN EXPLICIT IDENTITY GATE.
-- Minimal security hardening validated against the confirmed production
-- baseline. The equivalent statements were applied to production during the
-- approved integration test; this file records the resulting target state.

begin;

-- RLS limits profile updates to the caller's row, but table-level UPDATE
-- grants still allow privileged columns to be changed. The current Next.js
-- application performs profile administration with the explicit service_role,
-- so public API roles need no profile UPDATE capability.
revoke update on table public.profiles from public, anon, authenticated;

-- This legacy table is not used by the current app or firmware baseline.
-- Deny every public API role and add RLS as a second line of defence.
alter table public.manual_commands enable row level security;
revoke all privileges on table public.manual_commands
  from public, anon, authenticated;
revoke all privileges on sequence public.manual_commands_id_seq
  from public, anon, authenticated;

commit;
