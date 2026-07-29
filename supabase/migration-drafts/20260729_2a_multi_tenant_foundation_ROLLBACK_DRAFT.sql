-- DRAFT ONLY - ISOLATED TEST DATABASES ONLY.
-- DO NOT RUN AGAINST PRODUCTION.
-- This rollback intentionally refuses to remove tenant structures containing
-- assignments or rows. Delete synthetic test rows explicitly before retrying.

begin;

do $$
begin
  if exists (select 1 from public.organization_members limit 1)
    or exists (select 1 from public.sites limit 1)
    or exists (select 1 from public.organizations limit 1)
    or exists (
      select 1
      from public.greenhouses
      where organization_id is not null
        or site_id is not null
        or deployment_stage is not null
        or lifecycle_status is not null
      limit 1
    )
    or exists (
      select 1
      from public.devices
      where organization_id is not null
        or site_id is not null
        or deployment_stage is not null
        or lifecycle_status is not null
      limit 1
    )
  then
    raise exception
      '2A rollback refused: tenant rows or assignments still exist';
  end if;
end;
$$;

drop policy if exists "masters manage organization memberships"
  on public.organization_members;
drop policy if exists "members read own organization memberships"
  on public.organization_members;
drop policy if exists "masters manage sites" on public.sites;
drop policy if exists "members read sites" on public.sites;
drop policy if exists "masters manage organizations" on public.organizations;
drop policy if exists "members read organizations" on public.organizations;

drop function if exists public.has_organization_role(uuid, text[]);
drop function if exists public.is_platform_master();

drop index if exists public.devices_site_id_idx;
drop index if exists public.devices_organization_id_idx;
drop index if exists public.greenhouses_site_id_idx;
drop index if exists public.greenhouses_organization_id_idx;
drop index if exists public.organization_members_user_id_idx;
drop index if exists public.sites_organization_id_idx;

alter table public.devices
  drop column if exists lifecycle_status,
  drop column if exists deployment_stage,
  drop column if exists site_id,
  drop column if exists organization_id;

alter table public.greenhouses
  drop column if exists updated_at,
  drop column if exists lifecycle_status,
  drop column if exists deployment_stage,
  drop column if exists site_id,
  drop column if exists organization_id;

drop table if exists public.organization_members;
drop table if exists public.sites;
drop table if exists public.organizations;

commit;
