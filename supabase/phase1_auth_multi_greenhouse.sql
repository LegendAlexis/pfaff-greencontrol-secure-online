-- PHASE 1: Login, Benutzerprofile, Rollen und mehrere Gewächshäuser
-- ZUERST im Supabase SQL Editor ausführen.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.greenhouse_users (
  greenhouse_id bigint not null references public.greenhouses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner','operator','viewer')),
  created_at timestamptz not null default now(),
  primary key (greenhouse_id, user_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.greenhouse_users enable row level security;
alter table public.greenhouses enable row level security;
alter table public.watering_schedule enable row level security;
alter table public.warning_logs enable row level security;

-- Profile
create policy "users read own profile" on public.profiles
for select to authenticated using (id = auth.uid());
create policy "users update own profile" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Memberships
create policy "users read own memberships" on public.greenhouse_users
for select to authenticated using (user_id = auth.uid());

-- Greenhouses: any member can read; owner/operator can update.
create policy "members read greenhouses" on public.greenhouses
for select to authenticated using (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = id and gu.user_id = auth.uid())
);
create policy "operators update greenhouses" on public.greenhouses
for update to authenticated using (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = id and gu.user_id = auth.uid() and gu.role in ('owner','operator'))
) with check (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = id and gu.user_id = auth.uid() and gu.role in ('owner','operator'))
);

-- Schedules
create policy "members read schedules" on public.watering_schedule
for select to authenticated using (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = watering_schedule.greenhouse_id and gu.user_id = auth.uid())
);
create policy "operators manage schedules" on public.watering_schedule
for all to authenticated using (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = watering_schedule.greenhouse_id and gu.user_id = auth.uid() and gu.role in ('owner','operator'))
) with check (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = watering_schedule.greenhouse_id and gu.user_id = auth.uid() and gu.role in ('owner','operator'))
);

-- Warnings
create policy "members read warnings" on public.warning_logs
for select to authenticated using (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = warning_logs.greenhouse_id and gu.user_id = auth.uid())
);
create policy "operators manage warnings" on public.warning_logs
for all to authenticated using (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = warning_logs.greenhouse_id and gu.user_id = auth.uid() and gu.role in ('owner','operator'))
) with check (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = warning_logs.greenhouse_id and gu.user_id = auth.uid() and gu.role in ('owner','operator'))
);

-- WICHTIG: Nach dem ersten Login Benutzer-ID unter Authentication > Users kopieren
-- und dann einmal ausführen (UUID ersetzen):
-- insert into public.greenhouse_users (greenhouse_id, user_id, role)
-- values (1, 'DEINE-USER-UUID', 'owner')
-- on conflict (greenhouse_id, user_id) do update set role = excluded.role;
