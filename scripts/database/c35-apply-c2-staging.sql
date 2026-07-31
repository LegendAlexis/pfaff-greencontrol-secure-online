\set ON_ERROR_STOP on

\echo 'C3.5 PHASE 1: STAGING DATABASE PREFLIGHT'
begin transaction read only;

do $$
declare
  actual_read_only text := current_setting('transaction_read_only');
  actual_database text := current_database();
begin
  if actual_read_only <> 'on' then
    raise exception
      'C3.5 READ-ONLY PREFLIGHT FAILED: expected on, actual %',
      actual_read_only;
  end if;

  if actual_database <> 'postgres' then
    raise exception
      'C3.5 DATABASE PREFLIGHT FAILED: expected postgres, actual %',
      actual_database;
  end if;

  if to_regclass('public.device_commands') is not null then
    raise exception
      'C3.5 CLEAN-START PREFLIGHT FAILED: public.device_commands already exists';
  end if;
end
$$;

rollback;

\echo 'C3.5 PHASE 2: APPLY C2 MIGRATION TO STAGING'
\ir ../../supabase/migration-drafts/20260731_c2_device_commands_DRAFT.sql

\echo 'C3.5 PHASE 3: C2 PERSISTENCE POSTFLIGHT'
begin transaction read only;

do $$
declare
  actual_columns bigint;
  actual_policies bigint;
  actual_rls boolean;
begin
  select count(*) into actual_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'device_commands';

  if actual_columns <> 14 then
    raise exception
      'C3.5 C2 POSTFLIGHT FAILED: expected 14 columns, actual %',
      actual_columns;
  end if;

  select relation.relrowsecurity into actual_rls
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = 'device_commands';

  if actual_rls is distinct from true then
    raise exception
      'C3.5 C2 POSTFLIGHT FAILED: RLS expected true, actual %',
      actual_rls;
  end if;

  select count(*) into actual_policies
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'device_commands';

  if actual_policies <> 0 then
    raise exception
      'C3.5 C2 POSTFLIGHT FAILED: expected 0 policies, actual %',
      actual_policies;
  end if;
end
$$;

rollback;

\echo 'C3.5 C2 MIGRATION APPLIED TO STAGING'
