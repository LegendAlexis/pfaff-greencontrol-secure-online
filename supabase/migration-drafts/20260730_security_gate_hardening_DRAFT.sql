-- DRAFT ONLY - DO NOT RUN AGAINST PRODUCTION.
-- Minimal security hardening for the three approved Security Gate findings.
-- Prove this draft in the disposable test instance before separate approval.

begin;

-- RLS limits profile updates to the caller's row, but table-level UPDATE
-- grants still allow privileged columns to be changed. Remove the broad
-- grant and preserve only the harmless self-service name field.
revoke update on table public.profiles from public, anon, authenticated;
grant update (full_name) on table public.profiles to authenticated;

-- This legacy table is not used by the current app or firmware baseline.
-- Deny every public API role and add RLS as a second line of defence.
alter table public.manual_commands enable row level security;
revoke all privileges on table public.manual_commands
  from public, anon, authenticated;
revoke all privileges on sequence public.manual_commands_id_seq
  from public, anon, authenticated;

commit;
