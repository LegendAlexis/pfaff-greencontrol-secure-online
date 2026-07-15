begin;

alter table public.profiles add column if not exists system_role text not null default 'viewer';
alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles add column if not exists mfa_required boolean not null default false;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles drop constraint if exists profiles_system_role_check;
alter table public.profiles add constraint profiles_system_role_check check (system_role in ('admin','owner','operator','viewer'));

update public.profiles set system_role='admin',mfa_required=true where lower(email)='alexis765pfaff@gmail.com';
update public.profiles set system_role='owner',mfa_required=true where lower(email)='mpfaff@pfaff-biokraeuter.ch';

create table if not exists public.audit_logs (
 id bigint generated always as identity primary key,
 actor_user_id uuid references auth.users(id) on delete set null,
 action text not null,
 entity_type text not null,
 entity_id text,
 greenhouse_id bigint references public.greenhouses(id) on delete set null,
 old_value jsonb,
 new_value jsonb,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create table if not exists public.devices (
 id uuid primary key default gen_random_uuid(),
 greenhouse_id bigint not null references public.greenhouses(id) on delete cascade,
 name text not null,
 secret_hash text not null,
 active boolean not null default true,
 firmware_version text,
 last_seen timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(greenhouse_id,name)
);

alter table public.audit_logs enable row level security;
alter table public.devices enable row level security;

drop policy if exists "managers read audit logs" on public.audit_logs;
drop policy if exists "managers read devices" on public.devices;
create policy "managers read audit logs" on public.audit_logs for select to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.system_role in('admin','owner') and p.is_active));
create policy "managers read devices" on public.devices for select to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.system_role in('admin','owner') and p.is_active));

create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists devices_greenhouse_id_idx on public.devices(greenhouse_id);

commit;
