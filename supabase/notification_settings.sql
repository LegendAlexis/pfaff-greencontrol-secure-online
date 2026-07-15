-- Pfaff GreenControl: Rollen und Warnmail-Einstellungen
-- Alexis = admin, Marco = owner.
-- Admin/Owner dürfen alle Warnmail-Einstellungen verwalten.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  system_role text not null default 'viewer'
    check (system_role in ('admin','owner','operator','viewer')),
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists system_role text not null default 'viewer';

alter table public.profiles drop constraint if exists profiles_system_role_check;
alter table public.profiles add constraint profiles_system_role_check
  check (system_role in ('admin','owner','operator','viewer'));

insert into public.profiles (id, full_name, email, system_role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.email),
  u.email,
  case
    when lower(u.email) = 'alexis765pfaff@gmail.com' then 'admin'
    when lower(u.email) = 'mpfaff@pfaff-biokraeuter.ch' then 'owner'
    else 'viewer'
  end
from auth.users u
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  system_role = case
    when lower(excluded.email) = 'alexis765pfaff@gmail.com' then 'admin'
    when lower(excluded.email) = 'mpfaff@pfaff-biokraeuter.ch' then 'owner'
    else public.profiles.system_role
  end;

create or replace function public.is_system_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.system_role in ('admin','owner')
  );
$$;

grant execute on function public.is_system_manager() to authenticated;

create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_address text,
  email_enabled boolean not null default false,
  offline_alerts boolean not null default true,
  frost_alerts boolean not null default true,
  critical_alerts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Falls eine frühere Tabellenvariante existiert, passende App-Spalten ergänzen.
alter table public.notification_settings add column if not exists email_address text;
alter table public.notification_settings add column if not exists email_enabled boolean not null default false;
alter table public.notification_settings add column if not exists offline_alerts boolean not null default true;
alter table public.notification_settings add column if not exists frost_alerts boolean not null default true;
alter table public.notification_settings add column if not exists critical_alerts boolean not null default true;
alter table public.notification_settings add column if not exists created_at timestamptz not null default now();
alter table public.notification_settings add column if not exists updated_at timestamptz not null default now();

insert into public.notification_settings (user_id, email_address, email_enabled)
select id, email, false
from auth.users
on conflict (user_id) do nothing;

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

alter table public.profiles enable row level security;
alter table public.notification_settings enable row level security;
alter table public.email_notification_log enable row level security;

drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "managers read all profiles" on public.profiles;
drop policy if exists "managers update profiles" on public.profiles;

create policy "users read own profile" on public.profiles
for select to authenticated using (id = auth.uid());

create policy "managers read all profiles" on public.profiles
for select to authenticated using (public.is_system_manager());

create policy "managers update profiles" on public.profiles
for update to authenticated
using (public.is_system_manager())
with check (public.is_system_manager());

drop policy if exists "users read own notification settings" on public.notification_settings;
drop policy if exists "users insert own notification settings" on public.notification_settings;
drop policy if exists "users update own notification settings" on public.notification_settings;
drop policy if exists "managers read all notification settings" on public.notification_settings;
drop policy if exists "managers insert all notification settings" on public.notification_settings;
drop policy if exists "managers update all notification settings" on public.notification_settings;

create policy "users read own notification settings" on public.notification_settings
for select to authenticated using (user_id = auth.uid());

create policy "users insert own notification settings" on public.notification_settings
for insert to authenticated with check (user_id = auth.uid());

create policy "users update own notification settings" on public.notification_settings
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "managers read all notification settings" on public.notification_settings
for select to authenticated using (public.is_system_manager());

create policy "managers insert all notification settings" on public.notification_settings
for insert to authenticated with check (public.is_system_manager());

create policy "managers update all notification settings" on public.notification_settings
for update to authenticated
using (public.is_system_manager())
with check (public.is_system_manager());

drop policy if exists "users read own email log" on public.email_notification_log;
drop policy if exists "managers read email log" on public.email_notification_log;

create policy "users read own email log" on public.email_notification_log
for select to authenticated using (user_id = auth.uid());

create policy "managers read email log" on public.email_notification_log
for select to authenticated using (public.is_system_manager());

commit;
