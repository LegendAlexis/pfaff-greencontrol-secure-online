\set ON_ERROR_STOP on
\pset pager off

\echo 'PHASE 1/8: Starting controlled Staging transaction'

begin;

select json_build_object(
  'status', 'STAGING TRANSACTION STARTED',
  'database_name', current_database(),
  'transaction_read_only', current_setting('transaction_read_only'),
  'server_version', current_setting('server_version')
);

do $$
begin
  if current_database() <> 'postgres' then
    raise exception 'IDENTITY FAILURE: unexpected database';
  end if;

  if current_setting('transaction_read_only') <> 'off' then
    raise exception
      'PRECONDITION FAILURE: transaction must permit the approved Staging test';
  end if;
end
$$;

\echo 'PHASE 2/8: Verifying schema and policy baseline'

do $$
declare
  table_count integer;
  sequence_count integer;
  function_count integer;
  trigger_count integer;
  policy_count integer;
  rls_count integer;
  profile_policy_count integer;
  manual_policy_count integer;
begin
  select count(*) into table_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p');

  select count(*) into sequence_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'S';

  select count(*) into function_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public';

  select count(*) into trigger_count
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and not t.tgisinternal;

  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public';

  select count(*) into rls_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relrowsecurity;

  select count(*) into profile_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'profiles'
    and policyname in (
      'managers read all profiles',
      'managers update profiles',
      'users read own profile',
      'users update own profile'
    );

  select count(*) into manual_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'manual_commands';

  if table_count <> 13 then
    raise exception
      'SCHEMA FAILURE: expected 13 tables, found %',
      table_count;
  end if;

  if sequence_count <> 8 then
    raise exception
      'SCHEMA FAILURE: expected 8 sequences, found %',
      sequence_count;
  end if;

  if function_count <> 5 then
    raise exception
      'SCHEMA FAILURE: expected 5 functions, found %',
      function_count;
  end if;

  if trigger_count <> 2 then
    raise exception
      'SCHEMA FAILURE: expected 2 triggers, found %',
      trigger_count;
  end if;

  if policy_count <> 26 then
    raise exception
      'SCHEMA FAILURE: expected 26 policies, found %',
      policy_count;
  end if;

  if rls_count <> 12 then
    raise exception
      'SCHEMA FAILURE: expected 12 RLS tables, found %',
      rls_count;
  end if;

  if profile_policy_count <> 4 then
    raise exception
      'POLICY FAILURE: expected 4 profile policies, found %',
      profile_policy_count;
  end if;

  if manual_policy_count <> 0 then
    raise exception
      'POLICY FAILURE: manual_commands has % policies',
      manual_policy_count;
  end if;

  if not (
    select c.relrowsecurity
    from pg_class c
    where c.oid = 'public.profiles'::regclass
  ) then
    raise exception 'RLS FAILURE: profiles RLS is not enabled';
  end if;

  if (
    select c.relrowsecurity
    from pg_class c
    where c.oid = 'public.manual_commands'::regclass
  ) then
    raise exception
      'RLS FAILURE: manual_commands RLS baseline differs';
  end if;

  raise notice 'SCHEMA AND POLICY BASELINE PASSED';
end
$$;

\echo 'PHASE 3/8: Capturing policy and object identity baseline'

create temporary table public_object_snapshot on commit drop as
select
  c.oid,
  c.relname,
  c.relkind
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'S');

create temporary table policy_snapshot on commit drop as
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles::text,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public';

select 'POLICY AND OBJECT IDENTITY BASELINE CAPTURED' as status;

\echo 'PHASE 4/8: Simulating confirmed Production privileges'

grant select, insert, update, delete
  on table public.profiles
  to anon, authenticated;

grant select, insert, update, delete
  on table public.manual_commands
  to anon, authenticated;

grant usage, select, update
  on sequence public.manual_commands_id_seq
  to anon, authenticated;

grant select, insert, update, delete
  on table
    public.alert_states,
    public.audit_logs,
    public.devices,
    public.email_notification_log,
    public.greenhouse_users,
    public.greenhouses,
    public.manual_commands,
    public.notification_settings,
    public.profiles,
    public.sensor_readings,
    public.warning_logs,
    public.watering_schedule,
    public.weather_station
  to service_role;

grant usage, select, update
  on sequence
    public.audit_logs_id_seq,
    public.email_notification_log_id_seq,
    public.greenhouses_id_seq,
    public.manual_commands_id_seq,
    public.sensor_readings_id_seq,
    public.warning_logs_id_seq,
    public.watering_schedule_id_seq,
    public.weather_station_id_seq
  to service_role;

\echo 'PHASE 5/8: Verifying simulated Production ACL baseline'

do $$
declare
  column_name text;
  table_name text;
  sequence_name text;
  privilege_name text;
begin
  foreach column_name in array array[
    'id',
    'full_name',
    'email',
    'created_at',
    'system_role',
    'is_active',
    'mfa_required',
    'updated_at'
  ]
  loop
    if not has_column_privilege(
      'authenticated',
      'public.profiles',
      column_name,
      'UPDATE'
    ) then
      raise exception
        'SIMULATION FAILURE: authenticated lacks UPDATE on profiles.%',
        column_name;
    end if;
  end loop;

  if not (
    has_table_privilege('anon', 'public.manual_commands', 'SELECT')
    and has_table_privilege('anon', 'public.manual_commands', 'INSERT')
    and has_table_privilege('anon', 'public.manual_commands', 'UPDATE')
    and has_table_privilege('anon', 'public.manual_commands', 'DELETE')
    and has_table_privilege(
      'authenticated',
      'public.manual_commands',
      'SELECT'
    )
    and has_table_privilege(
      'authenticated',
      'public.manual_commands',
      'INSERT'
    )
    and has_table_privilege(
      'authenticated',
      'public.manual_commands',
      'UPDATE'
    )
    and has_table_privilege(
      'authenticated',
      'public.manual_commands',
      'DELETE'
    )
  ) then
    raise exception
      'SIMULATION FAILURE: manual_commands CRUD baseline differs';
  end if;

  if not (
    has_sequence_privilege(
      'anon',
      'public.manual_commands_id_seq',
      'USAGE'
    )
    and has_sequence_privilege(
      'anon',
      'public.manual_commands_id_seq',
      'SELECT'
    )
    and has_sequence_privilege(
      'anon',
      'public.manual_commands_id_seq',
      'UPDATE'
    )
    and has_sequence_privilege(
      'authenticated',
      'public.manual_commands_id_seq',
      'USAGE'
    )
    and has_sequence_privilege(
      'authenticated',
      'public.manual_commands_id_seq',
      'SELECT'
    )
    and has_sequence_privilege(
      'authenticated',
      'public.manual_commands_id_seq',
      'UPDATE'
    )
  ) then
    raise exception
      'SIMULATION FAILURE: manual_commands sequence baseline differs';
  end if;

  foreach table_name in array array[
    'alert_states',
    'audit_logs',
    'devices',
    'email_notification_log',
    'greenhouse_users',
    'greenhouses',
    'manual_commands',
    'notification_settings',
    'profiles',
    'sensor_readings',
    'warning_logs',
    'watering_schedule',
    'weather_station'
  ]
  loop
    foreach privilege_name in array array[
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE'
    ]
    loop
      if not has_table_privilege(
        'service_role',
        format('public.%I', table_name),
        privilege_name
      ) then
        raise exception
          'SIMULATION FAILURE: service_role lacks % on public.%',
          privilege_name,
          table_name;
      end if;
    end loop;
  end loop;

  foreach sequence_name in array array[
    'audit_logs_id_seq',
    'email_notification_log_id_seq',
    'greenhouses_id_seq',
    'manual_commands_id_seq',
    'sensor_readings_id_seq',
    'warning_logs_id_seq',
    'watering_schedule_id_seq',
    'weather_station_id_seq'
  ]
  loop
    foreach privilege_name in array array[
      'USAGE',
      'SELECT',
      'UPDATE'
    ]
    loop
      if not has_sequence_privilege(
        'service_role',
        format('public.%I', sequence_name),
        privilege_name
      ) then
        raise exception
          'SIMULATION FAILURE: service_role lacks % on public.%',
          privilege_name,
          sequence_name;
      end if;
    end loop;
  end loop;

  raise notice 'SIMULATED PRODUCTION ACL BASELINE PASSED';
end
$$;

-- Capture ACLs only after the confirmed Production ACL simulation. Phase 8
-- then proves that the security draft changes no unrelated relation.
create temporary table unaffected_relation_snapshot on commit drop as
select
  c.oid,
  c.relacl::text as relacl,
  c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'S')
  and c.oid not in (
    'public.profiles'::regclass,
    'public.manual_commands'::regclass,
    'public.manual_commands_id_seq'::regclass
  );

select 'SIMULATED PRODUCTION ACL SNAPSHOT CAPTURED' as status;

\echo 'PHASE 6/8: Applying minimal Security Draft'

revoke update on table public.profiles
  from public, anon, authenticated;

alter table public.manual_commands enable row level security;

revoke all privileges on table public.manual_commands
  from public, anon, authenticated;

revoke all privileges on sequence public.manual_commands_id_seq
  from public, anon, authenticated;

select 'MINIMAL SECURITY DRAFT APPLIED INSIDE TRANSACTION' as status;

\echo 'PHASE 7/8: Running postflight and negative permission tests'

do $$
declare
  column_name text;
  manual_policy_count integer;
begin
  foreach column_name in array array[
    'id',
    'full_name',
    'email',
    'created_at',
    'system_role',
    'is_active',
    'mfa_required',
    'updated_at'
  ]
  loop
    if has_column_privilege(
      'anon',
      'public.profiles',
      column_name,
      'UPDATE'
    ) then
      raise exception
        'POSTFLIGHT FAILURE: anon retains UPDATE on profiles.%',
        column_name;
    end if;

    if has_column_privilege(
      'authenticated',
      'public.profiles',
      column_name,
      'UPDATE'
    ) then
      raise exception
        'POSTFLIGHT FAILURE: authenticated retains UPDATE on profiles.%',
        column_name;
    end if;
  end loop;

  if not has_table_privilege(
    'service_role',
    'public.profiles',
    'UPDATE'
  ) then
    raise exception
      'FUNCTION FAILURE: service_role lost profiles UPDATE';
  end if;

  if not (
    select c.relrowsecurity
    from pg_class c
    where c.oid = 'public.manual_commands'::regclass
  ) then
    raise exception
      'POSTFLIGHT FAILURE: manual_commands RLS is disabled';
  end if;

  select count(*) into manual_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'manual_commands';

  if manual_policy_count <> 0 then
    raise exception
      'POSTFLIGHT FAILURE: manual_commands has % allow policies',
      manual_policy_count;
  end if;

  if
    has_table_privilege('anon', 'public.manual_commands', 'SELECT')
    or has_table_privilege('anon', 'public.manual_commands', 'INSERT')
    or has_table_privilege('anon', 'public.manual_commands', 'UPDATE')
    or has_table_privilege('anon', 'public.manual_commands', 'DELETE')
    or has_table_privilege(
      'authenticated',
      'public.manual_commands',
      'SELECT'
    )
    or has_table_privilege(
      'authenticated',
      'public.manual_commands',
      'INSERT'
    )
    or has_table_privilege(
      'authenticated',
      'public.manual_commands',
      'UPDATE'
    )
    or has_table_privilege(
      'authenticated',
      'public.manual_commands',
      'DELETE'
    )
  then
    raise exception
      'NEGATIVE TEST FAILURE: manual_commands CRUD remains';
  end if;

  if
    has_sequence_privilege(
      'anon',
      'public.manual_commands_id_seq',
      'USAGE'
    )
    or has_sequence_privilege(
      'anon',
      'public.manual_commands_id_seq',
      'SELECT'
    )
    or has_sequence_privilege(
      'anon',
      'public.manual_commands_id_seq',
      'UPDATE'
    )
    or has_sequence_privilege(
      'authenticated',
      'public.manual_commands_id_seq',
      'USAGE'
    )
    or has_sequence_privilege(
      'authenticated',
      'public.manual_commands_id_seq',
      'SELECT'
    )
    or has_sequence_privilege(
      'authenticated',
      'public.manual_commands_id_seq',
      'UPDATE'
    )
  then
    raise exception
      'NEGATIVE TEST FAILURE: manual_commands sequence rights remain';
  end if;

  raise notice 'POSTFLIGHT AND NEGATIVE PERMISSION TESTS PASSED';
end
$$;

\echo 'PHASE 8/8: Verifying unchanged policies, objects and legitimate access'

do $$
declare
  changed_relations integer;
  missing_relations integer;
  changed_policies integer;
  missing_policies integer;
  missing_objects integer;
begin
  select count(*) into changed_relations
  from unaffected_relation_snapshot snapshot
  join pg_class current_relation
    on current_relation.oid = snapshot.oid
  where snapshot.relacl is distinct from current_relation.relacl::text
     or snapshot.relrowsecurity
        is distinct from current_relation.relrowsecurity;

  select count(*) into missing_relations
  from unaffected_relation_snapshot snapshot
  left join pg_class current_relation
    on current_relation.oid = snapshot.oid
  where current_relation.oid is null;

  if changed_relations <> 0 or missing_relations <> 0 then
    raise exception
      'REGRESSION FAILURE: unrelated relations changed=% missing=%',
      changed_relations,
      missing_relations;
  end if;

  select count(*) into missing_objects
  from public_object_snapshot snapshot
  left join pg_class current_relation
    on current_relation.oid = snapshot.oid
  where current_relation.oid is null
     or current_relation.relname is distinct from snapshot.relname
     or current_relation.relkind is distinct from snapshot.relkind;

  if missing_objects <> 0 then
    raise exception
      'REGRESSION FAILURE: public object identities changed=%',
      missing_objects;
  end if;

  select count(*) into changed_policies
  from policy_snapshot snapshot
  join pg_policies current_policy
    on current_policy.schemaname = snapshot.schemaname
   and current_policy.tablename = snapshot.tablename
   and current_policy.policyname = snapshot.policyname
  where snapshot.permissive is distinct from current_policy.permissive
     or snapshot.roles is distinct from current_policy.roles::text
     or snapshot.cmd is distinct from current_policy.cmd
     or snapshot.qual is distinct from current_policy.qual
     or snapshot.with_check is distinct from current_policy.with_check;

  select count(*) into missing_policies
  from policy_snapshot snapshot
  left join pg_policies current_policy
    on current_policy.schemaname = snapshot.schemaname
   and current_policy.tablename = snapshot.tablename
   and current_policy.policyname = snapshot.policyname
  where current_policy.policyname is null;

  if changed_policies <> 0 or missing_policies <> 0 then
    raise exception
      'REGRESSION FAILURE: policies changed=% missing=%',
      changed_policies,
      missing_policies;
  end if;

  if not (
    has_table_privilege(
      'service_role',
      'public.devices',
      'SELECT'
    )
    and has_table_privilege(
      'service_role',
      'public.devices',
      'UPDATE'
    )
    and has_table_privilege(
      'service_role',
      'public.greenhouses',
      'SELECT'
    )
    and has_table_privilege(
      'service_role',
      'public.greenhouses',
      'UPDATE'
    )
    and has_table_privilege(
      'service_role',
      'public.sensor_readings',
      'INSERT'
    )
    and has_table_privilege(
      'service_role',
      'public.watering_schedule',
      'SELECT'
    )
  ) then
    raise exception
      'FUNCTION FAILURE: service_role heartbeat privileges are incomplete';
  end if;

  raise notice
    'UNCHANGED OBJECTS AND LEGITIMATE SERVICE-ROLE ACCESS PASSED';
end
$$;

select json_build_object(
  'status', 'ALL STAGING SECURITY TESTS PASSED',
  'profiles_authenticated_update',
    has_table_privilege(
      'authenticated',
      'public.profiles',
      'UPDATE'
    ),
  'profiles_service_role_update',
    has_table_privilege(
      'service_role',
      'public.profiles',
      'UPDATE'
    ),
  'manual_commands_rls',
    (
      select c.relrowsecurity
      from pg_class c
      where c.oid = 'public.manual_commands'::regclass
    ),
  'manual_commands_policies',
    (
      select count(*)
      from pg_policies
      where schemaname = 'public'
        and tablename = 'manual_commands'
    ),
  'anon_manual_commands_crud',
    (
      has_table_privilege(
        'anon',
        'public.manual_commands',
        'SELECT'
      )
      or has_table_privilege(
        'anon',
        'public.manual_commands',
        'INSERT'
      )
      or has_table_privilege(
        'anon',
        'public.manual_commands',
        'UPDATE'
      )
      or has_table_privilege(
        'anon',
        'public.manual_commands',
        'DELETE'
      )
    ),
  'authenticated_manual_commands_crud',
    (
      has_table_privilege(
        'authenticated',
        'public.manual_commands',
        'SELECT'
      )
      or has_table_privilege(
        'authenticated',
        'public.manual_commands',
        'INSERT'
      )
      or has_table_privilege(
        'authenticated',
        'public.manual_commands',
        'UPDATE'
      )
      or has_table_privilege(
        'authenticated',
        'public.manual_commands',
        'DELETE'
      )
    )
);

\echo 'ALL ASSERTIONS PASSED: committing hardened Staging state'

commit;

\echo 'STAGING SECURITY INTEGRATION TEST COMMITTED SUCCESSFULLY'
