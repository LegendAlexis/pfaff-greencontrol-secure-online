\set ON_ERROR_STOP on

\echo 'C2 STAGING PHASE 1: READ-ONLY PREFLIGHT'
begin transaction read only;

select case
  when current_setting('transaction_read_only') = 'on' then 1
  else 1 / 0
end as read_only_gate;

select case
  when current_database() = 'postgres' then 1
  else 1 / 0
end as database_name_gate;

select case
  when to_regclass('public.device_commands') is null then 1
  else 1 / 0
end as clean_start_gate;

rollback;

\echo 'C2 STAGING PHASE 2: APPLY FORWARD DRAFT'
\ir ../../supabase/migration-drafts/20260731_c2_device_commands_DRAFT.sql

\echo 'C2 STAGING PHASE 3: STRUCTURE AND PRIVILEGE POSTFLIGHT'
begin transaction read only;

select case
  when (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'device_commands'
  ) = 14 then 1
  else 1 / 0
end as column_count_gate;

select case
  when (
    select relation.relrowsecurity
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'device_commands'
  ) then 1
  else 1 / 0
end as rls_gate;

select case
  when (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'device_commands'
  ) = 0 then 1
  else 1 / 0
end as no_policy_gate;

select case
  when not has_table_privilege(
    'anon',
    'public.device_commands',
    'SELECT, INSERT, UPDATE, DELETE'
  ) and not has_table_privilege(
    'authenticated',
    'public.device_commands',
    'SELECT, INSERT, UPDATE, DELETE'
  ) and has_table_privilege(
    'service_role',
    'public.device_commands',
    'SELECT, INSERT, UPDATE, DELETE'
  ) then 1
  else 1 / 0
end as table_privilege_gate;

select case
  when not has_sequence_privilege(
    'anon',
    'public.device_commands_sequence_seq',
    'USAGE, SELECT, UPDATE'
  ) and not has_sequence_privilege(
    'authenticated',
    'public.device_commands_sequence_seq',
    'USAGE, SELECT, UPDATE'
  ) and has_sequence_privilege(
    'service_role',
    'public.device_commands_sequence_seq',
    'USAGE, SELECT, UPDATE'
  ) then 1
  else 1 / 0
end as sequence_privilege_gate;

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

select case
  when (
    select count(*)
    from public.device_commands
    where device_id = :'fixture_device_id'
  ) = 3 then 1
  else 1 / 0
end as three_core_actuators_gate;

select case
  when (
    select count(distinct sequence)
    from public.device_commands
    where device_id = :'fixture_device_id'
  ) = 3 then 1
  else 1 / 0
end as distinct_sequence_gate;

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

select case
  when to_regclass('public.device_commands') is null then 1
  else 1 / 0
end as rollback_removed_table_gate;

select case
  when not exists (
    select 1
    from public.devices
    where id = :'fixture_device_id'
  ) then 1
  else 1 / 0
end as fixture_device_removed_gate;

select case
  when not exists (
    select 1
    from public.greenhouses
    where id = :fixture_greenhouse_id
  ) then 1
  else 1 / 0
end as fixture_greenhouse_removed_gate;

rollback;

\echo 'C2 STAGING VALIDATION PASSED; BASELINE RESTORED'
