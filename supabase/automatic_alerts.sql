-- Pfaff GreenControl: automatische Warnungen mit Zustandswechsel und Entwarnung.
-- Dieses Script darf mehrfach ausgeführt werden.

begin;

alter table public.greenhouses
  add column if not exists monitoring_enabled boolean not null default false;

create table if not exists public.alert_states (
  source_type text not null,
  source_id bigint not null,
  alert_type text not null check (alert_type in ('offline','frost','critical')),
  active boolean not null default false,
  activated_at timestamptz,
  resolved_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (source_type, source_id, alert_type)
);

create table if not exists public.email_notification_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  greenhouse_id bigint references public.greenhouses(id) on delete cascade,
  warning_key text not null,
  subject text not null,
  status text not null default 'pending'
    check (status in ('pending','sent','failed','suppressed')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.alert_states enable row level security;
alter table public.email_notification_log enable row level security;

drop policy if exists "managers read alert states" on public.alert_states;
drop policy if exists "users read own email log" on public.email_notification_log;
drop policy if exists "managers read email log" on public.email_notification_log;

create policy "managers read alert states"
on public.alert_states for select to authenticated
using (public.is_system_manager());

create policy "users read own email log"
on public.email_notification_log for select to authenticated
using (user_id = auth.uid());

create policy "managers read email log"
on public.email_notification_log for select to authenticated
using (public.is_system_manager());

commit;

-- WICHTIG: Erst aktivieren, wenn das echte Gerät zuverlässig sendet.
-- Beispiel für Gewächshaus 1:
-- update public.greenhouses set monitoring_enabled = true where id = 1;
