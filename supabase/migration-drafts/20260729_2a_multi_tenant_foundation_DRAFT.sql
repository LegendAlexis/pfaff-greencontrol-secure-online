-- DRAFT ONLY - DO NOT RUN AGAINST PRODUCTION.
-- Phase 2A.1 defines an additive proposal. Reconcile it with a safe
-- schema-only export and prove it in an isolated database before execution.

begin;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  deployment_stage text not null default 'pilot'
    check (deployment_stage in ('pilot', 'production')),
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  name text not null,
  slug text not null,
  timezone text not null default 'Europe/Zurich',
  deployment_stage text not null default 'pilot'
    check (deployment_stage in ('pilot', 'production')),
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.organization_members (
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'operator', 'viewer')),
  membership_status text not null default 'active'
    check (membership_status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- Existing identifiers and relationships remain unchanged. Tenant columns are
-- nullable until a separately tested backfill has assigned every legacy row.
alter table public.greenhouses
  add column if not exists organization_id uuid null
    references public.organizations(id) on delete restrict,
  add column if not exists site_id uuid null
    references public.sites(id) on delete restrict,
  add column if not exists deployment_stage text null
    check (deployment_stage is null or deployment_stage in ('pilot', 'production')),
  add column if not exists lifecycle_status text null
    check (lifecycle_status is null or lifecycle_status in ('active', 'archived')),
  add column if not exists updated_at timestamptz null;

alter table public.devices
  add column if not exists organization_id uuid null
    references public.organizations(id) on delete restrict,
  add column if not exists site_id uuid null
    references public.sites(id) on delete restrict,
  add column if not exists deployment_stage text null
    check (deployment_stage is null or deployment_stage in ('pilot', 'production')),
  add column if not exists lifecycle_status text null
    check (lifecycle_status is null or lifecycle_status in ('active', 'archived'));

create index if not exists sites_organization_id_idx
  on public.sites(organization_id);
create index if not exists organization_members_user_id_idx
  on public.organization_members(user_id);
create index if not exists greenhouses_organization_id_idx
  on public.greenhouses(organization_id);
create index if not exists greenhouses_site_id_idx
  on public.greenhouses(site_id);
create index if not exists devices_organization_id_idx
  on public.devices(organization_id);
create index if not exists devices_site_id_idx
  on public.devices(site_id);

alter table public.organizations enable row level security;
alter table public.sites enable row level security;
alter table public.organization_members enable row level security;

-- Temporary compatibility helper: current repositories use "admin".
-- No role value is changed by this draft.
create or replace function public.is_platform_master()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_active = true
      and profile.system_role in ('admin', 'master_admin')
  );
$$;

create or replace function public.has_organization_role(
  target_organization_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
      and membership.membership_status = 'active'
      and membership.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_platform_master() from public;
revoke all on function public.has_organization_role(uuid, text[]) from public;
grant execute on function public.is_platform_master() to authenticated;
grant execute on function public.has_organization_role(uuid, text[])
  to authenticated;

create policy "members read organizations"
on public.organizations
for select
to authenticated
using (
  public.is_platform_master()
  or public.has_organization_role(id, array['owner', 'operator', 'viewer'])
);

create policy "masters manage organizations"
on public.organizations
for all
to authenticated
using (public.is_platform_master())
with check (public.is_platform_master());

create policy "members read sites"
on public.sites
for select
to authenticated
using (
  public.is_platform_master()
  or public.has_organization_role(
    organization_id,
    array['owner', 'operator', 'viewer']
  )
);

create policy "masters manage sites"
on public.sites
for all
to authenticated
using (public.is_platform_master())
with check (public.is_platform_master());

create policy "members read own organization memberships"
on public.organization_members
for select
to authenticated
using (
  public.is_platform_master()
  or user_id = auth.uid()
  or public.has_organization_role(organization_id, array['owner'])
);

create policy "masters manage organization memberships"
on public.organization_members
for all
to authenticated
using (public.is_platform_master())
with check (public.is_platform_master());

commit;
