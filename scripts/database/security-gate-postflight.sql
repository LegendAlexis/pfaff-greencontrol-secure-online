\set ON_ERROR_STOP on

do $security_gate$
declare
  manual_commands_rls boolean;
  manual_commands_policies integer;
  required_functions integer;
  required_triggers integer;
  service_role_explicit_update boolean;
begin
  select c.relrowsecurity
    into manual_commands_rls
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'manual_commands'
     and c.relkind = 'r';

  select count(*)
    into manual_commands_policies
    from pg_catalog.pg_policies
   where schemaname = 'public'
     and tablename = 'manual_commands';

  select count(*)
    into required_functions
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (
       'assign_managers_to_new_greenhouse',
       'handle_new_notification_settings',
       'handle_new_user',
       'is_system_manager',
       'set_notification_settings_updated_at'
     );

  select count(*)
    into required_triggers
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and not t.tgisinternal
     and t.tgname in (
       'assign_managers_after_greenhouse_insert',
       'notification_settings_set_updated_at'
     );

  if pg_catalog.has_table_privilege(
    'anon',
    'public.profiles',
    'UPDATE'
  ) then
    raise exception 'Postflight failed: anon retains broad profile UPDATE';
  end if;

  if pg_catalog.has_table_privilege(
    'authenticated',
    'public.profiles',
    'UPDATE'
  ) then
    raise exception
      'Postflight failed: authenticated retains broad profile UPDATE';
  end if;

  if (
    pg_catalog.has_column_privilege(
      'authenticated',
      'public.profiles',
      'full_name',
      'UPDATE'
    )
    or pg_catalog.has_column_privilege(
      'authenticated',
      'public.profiles',
      'system_role',
      'UPDATE'
    )
    or pg_catalog.has_column_privilege(
      'authenticated',
      'public.profiles',
      'is_active',
      'UPDATE'
    )
    or pg_catalog.has_column_privilege(
      'authenticated',
      'public.profiles',
      'mfa_required',
      'UPDATE'
    )
  ) then
    raise exception 'Postflight failed: authenticated profile UPDATE remains';
  end if;

  select exists (
    select 1
      from pg_catalog.pg_class c
      cross join lateral pg_catalog.aclexplode(c.relacl) acl
      join pg_catalog.pg_roles r on r.oid = acl.grantee
     where c.oid = 'public.profiles'::regclass
       and r.rolname = 'service_role'
       and acl.privilege_type = 'UPDATE'
  )
    into service_role_explicit_update;

  if service_role_explicit_update is distinct from true
     or not pg_catalog.has_table_privilege(
       'service_role',
       'public.profiles',
       'UPDATE'
     ) then
    raise exception
      'Postflight failed: service_role profile UPDATE is not preserved';
  end if;

  if manual_commands_rls is distinct from true then
    raise exception 'Postflight failed: manual_commands RLS is not enabled';
  end if;

  if manual_commands_policies <> 0 then
    raise exception 'Postflight failed: manual_commands has an allow policy';
  end if;

  if (
    pg_catalog.has_table_privilege(
      'anon', 'public.manual_commands', 'SELECT'
    )
    or pg_catalog.has_table_privilege(
      'anon', 'public.manual_commands', 'INSERT'
    )
    or pg_catalog.has_table_privilege(
      'anon', 'public.manual_commands', 'UPDATE'
    )
    or pg_catalog.has_table_privilege(
      'anon', 'public.manual_commands', 'DELETE'
    )
    or pg_catalog.has_table_privilege(
      'authenticated', 'public.manual_commands', 'SELECT'
    )
    or pg_catalog.has_table_privilege(
      'authenticated', 'public.manual_commands', 'INSERT'
    )
    or pg_catalog.has_table_privilege(
      'authenticated', 'public.manual_commands', 'UPDATE'
    )
    or pg_catalog.has_table_privilege(
      'authenticated', 'public.manual_commands', 'DELETE'
    )
  ) then
    raise exception 'Postflight failed: manual_commands CRUD remains';
  end if;

  if (
    pg_catalog.has_sequence_privilege(
      'anon', 'public.manual_commands_id_seq', 'USAGE'
    )
    or pg_catalog.has_sequence_privilege(
      'anon', 'public.manual_commands_id_seq', 'SELECT'
    )
    or pg_catalog.has_sequence_privilege(
      'anon', 'public.manual_commands_id_seq', 'UPDATE'
    )
    or pg_catalog.has_sequence_privilege(
      'authenticated', 'public.manual_commands_id_seq', 'USAGE'
    )
    or pg_catalog.has_sequence_privilege(
      'authenticated', 'public.manual_commands_id_seq', 'SELECT'
    )
    or pg_catalog.has_sequence_privilege(
      'authenticated', 'public.manual_commands_id_seq', 'UPDATE'
    )
  ) then
    raise exception 'Postflight failed: manual_commands sequence remains open';
  end if;

  if required_functions <> 5 then
    raise exception 'Postflight failed: existing functions changed';
  end if;

  if required_triggers <> 2 then
    raise exception 'Postflight failed: existing public triggers changed';
  end if;
end
$security_gate$;

select json_build_object(
  'phase', 'security-gate-postflight',
  'expected_profiles_privileged_update', false,
  'actual_profiles_privileged_update',
    pg_catalog.has_column_privilege(
      'authenticated',
      'public.profiles',
      'system_role',
      'UPDATE'
    ),
  'expected_authenticated_full_name_update', false,
  'actual_full_name_update',
    pg_catalog.has_column_privilege(
      'authenticated',
      'public.profiles',
      'full_name',
      'UPDATE'
    ),
  'expected_service_role_profile_update', true,
  'actual_service_role_profile_update',
    pg_catalog.has_table_privilege(
      'service_role',
      'public.profiles',
      'UPDATE'
    ),
  'expected_manual_commands_rls', true,
  'actual_manual_commands_rls', (
    select c.relrowsecurity
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'manual_commands'
       and c.relkind = 'r'
  ),
  'expected_manual_commands_crud', false,
  'actual_anon_manual_commands_crud',
    (
      pg_catalog.has_table_privilege(
        'anon', 'public.manual_commands', 'SELECT'
      )
      or pg_catalog.has_table_privilege(
        'anon', 'public.manual_commands', 'INSERT'
      )
      or pg_catalog.has_table_privilege(
        'anon', 'public.manual_commands', 'UPDATE'
      )
      or pg_catalog.has_table_privilege(
        'anon', 'public.manual_commands', 'DELETE'
      )
    ),
  'actual_authenticated_manual_commands_crud',
    (
      pg_catalog.has_table_privilege(
        'authenticated', 'public.manual_commands', 'SELECT'
      )
      or pg_catalog.has_table_privilege(
        'authenticated', 'public.manual_commands', 'INSERT'
      )
      or pg_catalog.has_table_privilege(
        'authenticated', 'public.manual_commands', 'UPDATE'
      )
      or pg_catalog.has_table_privilege(
        'authenticated', 'public.manual_commands', 'DELETE'
      )
    ),
  'existing_functions_preserved', true,
  'existing_public_triggers_preserved', true
) as security_gate_postflight;
