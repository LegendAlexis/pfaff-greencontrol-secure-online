-- Pfaff GreenControl V2
-- Login, Rollen, mehrere Gewächshäuser, Wetterstation und Diagramm-Historie.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.greenhouse_users (
  greenhouse_id bigint not null references public.greenhouses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner','operator','viewer')),
  created_at timestamptz not null default now(),
  primary key (greenhouse_id, user_id)
);

create table if not exists public.sensor_readings (
  id bigint generated always as identity primary key,
  greenhouse_id bigint not null references public.greenhouses(id) on delete cascade,
  temperature double precision,
  roof_window_open boolean,
  wall_window_open boolean,
  watering_on boolean,
  created_at timestamptz not null default now()
);

alter table public.weather_station add column if not exists wind_gust double precision;
alter table public.weather_station add column if not exists wind_direction double precision;
alter table public.weather_station add column if not exists pressure double precision;
alter table public.weather_station add column if not exists status text default 'offline';
alter table public.weather_station add column if not exists last_seen timestamptz;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.greenhouse_users enable row level security;
alter table public.greenhouses enable row level security;
alter table public.watering_schedule enable row level security;
alter table public.warning_logs enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.weather_station enable row level security;

-- Alte Policies mit gleichen Namen zuerst entfernen.
drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "users read own memberships" on public.greenhouse_users;
drop policy if exists "members read greenhouses" on public.greenhouses;
drop policy if exists "operators update greenhouses" on public.greenhouses;
drop policy if exists "members read schedules" on public.watering_schedule;
drop policy if exists "operators manage schedules" on public.watering_schedule;
drop policy if exists "members read warnings" on public.warning_logs;
drop policy if exists "operators manage warnings" on public.warning_logs;

create policy "users read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "users read own memberships" on public.greenhouse_users for select to authenticated using (user_id = auth.uid());

create policy "members read greenhouses" on public.greenhouses for select to authenticated using (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = greenhouses.id and gu.user_id = auth.uid())
);
create policy "operators update greenhouses" on public.greenhouses for update to authenticated using (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = greenhouses.id and gu.user_id = auth.uid() and gu.role in ('owner','operator'))
) with check (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = greenhouses.id and gu.user_id = auth.uid() and gu.role in ('owner','operator'))
);

create policy "members read schedules" on public.watering_schedule for select to authenticated using (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = watering_schedule.greenhouse_id and gu.user_id = auth.uid())
);
create policy "operators manage schedules" on public.watering_schedule for all to authenticated using (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = watering_schedule.greenhouse_id and gu.user_id = auth.uid() and gu.role in ('owner','operator'))
) with check (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = watering_schedule.greenhouse_id and gu.user_id = auth.uid() and gu.role in ('owner','operator'))
);

create policy "members read warnings" on public.warning_logs for select to authenticated using (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = warning_logs.greenhouse_id and gu.user_id = auth.uid())
);
create policy "operators manage warnings" on public.warning_logs for all to authenticated using (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = warning_logs.greenhouse_id and gu.user_id = auth.uid() and gu.role in ('owner','operator'))
) with check (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = warning_logs.greenhouse_id and gu.user_id = auth.uid() and gu.role in ('owner','operator'))
);

create policy "members read sensor history" on public.sensor_readings for select to authenticated using (
  exists (select 1 from public.greenhouse_users gu where gu.greenhouse_id = sensor_readings.greenhouse_id and gu.user_id = auth.uid())
);
create policy "authenticated read weather" on public.weather_station for select to authenticated using (true);

-- Besitzer nach ERSTEM Login freischalten:
-- Der Benutzer mpfaff@pfaff-biokraeuter.ch muss vorher unter Authentication > Users existieren.
-- Danach ausführen:
-- insert into public.greenhouse_users (greenhouse_id, user_id, role)
-- select g.id, u.id, 'owner'
-- from public.greenhouses g
-- cross join auth.users u
-- where lower(u.email) = 'mpfaff@pfaff-biokraeuter.ch'
-- on conflict (greenhouse_id, user_id) do update set role = 'owner';
