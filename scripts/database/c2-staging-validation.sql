\set ON_ERROR_STOP on

\echo 'C2 STAGING PHASE 1: READ-ONLY PREFLIGHT'
begin transaction read only;

do $$
declare
  actual_read_only text := current_setting('transaction_read_only');
  actual_database text := current_database();
begin
  if actual_read_only <> 'on' then
    raise exception
      'C2 READ-ONLY PREFLIGHT FAILED: transaction_read_only expected on, actual %',
      actual_read_only;
  end if;

  if actual_database <> 'postgres' then
    raise exception
      'C2 DATABASE PREFLIGHT FAILED: database expected postgres, actual %',
      actual_database;
  end if;

  if to_regclass('public.device_commands') is not null then
    raise exception
      'C2 CLEAN-START PREFLIGHT FAILED: public.device_commands already exists';
  end if;
end
$$;

\echo 'C2 STAGING PREFLIGHT PASSED'

rollback;

\echo 'C2 STAGING PHASE 2: APPLY FORWARD DRAFT'
\ir ../../supabase/migration-drafts/20260731_c2_device_commands_DRAFT.sql

\echo 'C2 STAGING PHASE 3: STRUCTURE AND PRIVILEGE POSTFLIGHT'
begin transaction read only;

do $$
declare
  actual_column_count bigint;
  actual_policy_count bigint;
  actual_rls boolean;
begin
  select count(*) into actual_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'device_commands';

  if actual_column_count <> 14 then
    raise exception
      'C2 STRUCTURE POSTFLIGHT FAILED: expected 14 columns, actual %',
      actual_column_count;
  end if;

  select relation.relrowsecurity into actual_rls
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = 'device_commands';

  if actual_rls is distinct from true then
    raise exception
      'C2 RLS POSTFLIGHT FAILED: expected true, actual %',
      actual_rls;
  end if;

  select count(*) into actual_policy_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'device_commands';

  if actual_policy_count <> 0 then
    raise exception
      'C2 POLICY POSTFLIGHT FAILED: expected 0 policies, actual %',
      actual_policy_count;
  end if;

  if has_table_privilege(
    'anon',
    'public.device_commands',
    'SELECT, INSERT, UPDATE, DELETE'
  ) or has_table_privilege(
    'authenticated',
    'public.device_commands',
    'SELECT, INSERT, UPDATE, DELETE'
  ) or not has_table_privilege(
    'service_role',
    'public.device_commands',
    'SELECT, INSERT, UPDATE, DELETE'
  ) then
    raise exception
      'C2 TABLE PRIVILEGE POSTFLIGHT FAILED: public roles must have none and service_role must have CRUD';
  end if;

  if has_sequence_privilege(
    'anon',
    'public.device_commands_sequence_seq',
    'USAGE, SELECT, UPDATE'
  ) or has_sequence_privilege(
    'authenticated',
    'public.device_commands_sequence_seq',
    'USAGE, SELECT, UPDATE'
  ) or not has_sequence_privilege(
    'service_role',
    'public.device_commands_sequence_seq',
    'USAGE, SELECT, UPDATE'
  ) then
    raise exception
      'C2 SEQUENCE PRIVILEGE POSTFLIGHT FAILED: public roles must have none and service_role must have USAGE, SELECT, UPDATE';
  end if;
end
$$;

\echo 'C2 STRUCTURE AND PRIVILEGE POSTFLIGHT PASSED'

rollback;

\echo 'C2 STAGING PHASE 4: POSITIVE AND NEGATIVE INTEGRATION TESTS'
begin;

select gen_random_uuid() as fixture_device_id \gset
\set fixture_greenhouse_id -9223372036854775000

insert into public.greenhouses (id, name)
values (
  :fixture_greenhouse_id,
  'C2 isolated staging validation'
);

insert into public.devices (
  id,
  greenhouse_id,
  name,
  secret_hash,
  active
)
values (
  :'fixture_device_id',
  :fixture_greenhouse_id,
  'C2 isolated staging validation',
  repeat('0', 64),
  false
);

insert into public.device_commands (
  device_id,
  actuator,
  command,
  payload,
  expires_at
)
values
  (
    :'fixture_device_id',
    'watering',
    'set',
    '{"state":"on"}'::jsonb,
    now() + interval '2 minutes'
  ),
  (
    :'fixture_device_id',
    'roof_window',
    'move',
    '{"action":"stop"}'::jsonb,
    now() + interval '2 minutes'
  ),
  (
    :'fixture_device_id',
    'side_window',
    'move',
    '{"action":"close"}'::jsonb,
    now() + interval '2 minutes'
  );

do $$
declare
  target_device_id uuid;
  actual_commands bigint;
  actual_sequences bigint;
begin
  select id into strict target_device_id
  from public.devices
  where name = 'C2 isolated staging validation';

  select count(*), count(distinct sequence)
    into actual_commands, actual_sequences
  from public.device_commands
  where device_id = target_device_id;

  if actual_commands <> 3 then
    raise exception
      'C2 POSITIVE TEST FAILED: expected 3 core-actuator commands, actual %',
      actual_commands;
  end if;

  if actual_sequences <> 3 then
    raise exception
      'C2 SEQUENCE TEST FAILED: expected 3 distinct sequences, actual %',
      actual_sequences;
  end if;
end
$$;

\echo 'C2 POSITIVE COMMAND AND SEQUENCE TESTS PASSED'

do $$
declare
  target_device_id uuid;
begin
  select id into strict target_device_id
  from public.devices
  where name = 'C2 isolated staging validation';

  begin
    insert into public.device_commands (
      device_id,
      actuator,
      command,
      payload,
      expires_at
    )
    values (
      target_device_id,
      'watering',
      'move',
      '{"action":"open"}'::jsonb,
      now() + interval '2 minutes'
    );
    raise exception 'NEGATIVE TEST FAILED: mismatched watering command accepted';
  exception
    when check_violation then null;
  end;
end
$$;

do $$
declare
  target_device_id uuid;
begin
  select id into strict target_device_id
  from public.devices
  where name = 'C2 isolated staging validation';

  begin
    insert into public.device_commands (
      device_id,
      actuator,
      command,
      payload,
      expires_at
    )
    values (
      target_device_id,
      'roof_window',
      'move',
      '{"action":"open","unexpected":true}'::jsonb,
      now() + interval '2 minutes'
    );
    raise exception 'NEGATIVE TEST FAILED: extra payload field accepted';
  exception
    when check_violation then null;
  end;
end
$$;

do $$
declare
  target_device_id uuid;
begin
  select id into strict target_device_id
  from public.devices
  where name = 'C2 isolated staging validation';

  begin
    insert into public.device_commands (
      device_id,
      actuator,
      command,
      payload,
      expires_at
    )
    values (
      target_device_id,
      'side_window',
      'move',
      '{"action":"open"}'::jsonb,
      now()
    );
    raise exception 'NEGATIVE TEST FAILED: nonpositive validity accepted';
  exception
    when check_violation then null;
  end;
end
$$;

do $$
declare
  target_device_id uuid;
begin
  select id into strict target_device_id
  from public.devices
  where name = 'C2 isolated staging validation';

  begin
    delete from public.devices
    where id = target_device_id;
    raise exception 'NEGATIVE TEST FAILED: device history deletion accepted';
  exception
    when foreign_key_violation then null;
  end;
end
$$;

delete from public.device_commands
where device_id = :'fixture_device_id';

delete from public.devices
where id = :'fixture_device_id';

delete from public.greenhouses
where id = :fixture_greenhouse_id;

commit;

\echo 'C2 STAGING PHASE 5: ROLLBACK TEST'
\ir ../../supabase/migration-drafts/20260731_c2_device_commands_ROLLBACK_DRAFT.sql

\echo 'C2 STAGING PHASE 6: FINAL READ-ONLY POSTFLIGHT'
begin transaction read only;

do $$
begin
  if to_regclass('public.device_commands') is not null then
    raise exception
      'C2 ROLLBACK POSTFLIGHT FAILED: public.device_commands still exists';
  end if;

  if exists (
    select 1
    from public.devices
    where name = 'C2 isolated staging validation'
  ) then
    raise exception
      'C2 FIXTURE POSTFLIGHT FAILED: validation device still exists';
  end if;

  if exists (
    select 1
    from public.greenhouses
    where id = -9223372036854775000
  ) then
    raise exception
      'C2 FIXTURE POSTFLIGHT FAILED: validation greenhouse still exists';
  end if;
end
$$;

\echo 'C2 ROLLBACK AND FIXTURE POSTFLIGHT PASSED'

rollback;

\echo 'C2 STAGING VALIDATION PASSED; BASELINE RESTORED'
