\set ON_ERROR_STOP on

do $security_gate$
declare
  profiles_rls boolean;
  manual_commands_rls boolean;
begin
  select c.relrowsecurity
    into profiles_rls
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'profiles'
     and c.relkind = 'r';

  select c.relrowsecurity
    into manual_commands_rls
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'manual_commands'
     and c.relkind = 'r';

  if profiles_rls is distinct from true then
    raise exception 'Preflight failed: profiles RLS baseline differs';
  end if;

  if manual_commands_rls is distinct from false then
    raise exception 'Preflight failed: manual_commands RLS baseline differs';
  end if;

  if not pg_catalog.has_column_privilege(
    'authenticated',
    'public.profiles',
    'system_role',
    'UPDATE'
  ) then
    raise exception 'Preflight failed: expected profile weakness is absent';
  end if;

  if not (
    pg_catalog.has_table_privilege(
      'anon', 'public.manual_commands', 'SELECT'
    )
    and pg_catalog.has_table_privilege(
      'anon', 'public.manual_commands', 'INSERT'
    )
    and pg_catalog.has_table_privilege(
      'anon', 'public.manual_commands', 'UPDATE'
    )
    and pg_catalog.has_table_privilege(
      'anon', 'public.manual_commands', 'DELETE'
    )
    and pg_catalog.has_table_privilege(
      'authenticated', 'public.manual_commands', 'SELECT'
    )
    and pg_catalog.has_table_privilege(
      'authenticated', 'public.manual_commands', 'INSERT'
    )
    and pg_catalog.has_table_privilege(
      'authenticated', 'public.manual_commands', 'UPDATE'
    )
    and pg_catalog.has_table_privilege(
      'authenticated', 'public.manual_commands', 'DELETE'
    )
  ) then
    raise exception 'Preflight failed: manual_commands baseline differs';
  end if;
end
$security_gate$;

select json_build_object(
  'phase', 'security-gate-preflight',
  'expected_profiles_self_escalation', true,
  'actual_profiles_privileged_update',
    pg_catalog.has_column_privilege(
      'authenticated',
      'public.profiles',
      'system_role',
      'UPDATE'
    ),
  'expected_manual_commands_public_crud', true,
  'actual_anon_manual_commands_crud',
    (
      pg_catalog.has_table_privilege(
        'anon', 'public.manual_commands', 'SELECT'
      )
      and pg_catalog.has_table_privilege(
        'anon', 'public.manual_commands', 'INSERT'
      )
      and pg_catalog.has_table_privilege(
        'anon', 'public.manual_commands', 'UPDATE'
      )
      and pg_catalog.has_table_privilege(
        'anon', 'public.manual_commands', 'DELETE'
      )
    ),
  'actual_authenticated_manual_commands_crud',
    (
      pg_catalog.has_table_privilege(
        'authenticated', 'public.manual_commands', 'SELECT'
      )
      and pg_catalog.has_table_privilege(
        'authenticated', 'public.manual_commands', 'INSERT'
      )
      and pg_catalog.has_table_privilege(
        'authenticated', 'public.manual_commands', 'UPDATE'
      )
      and pg_catalog.has_table_privilege(
        'authenticated', 'public.manual_commands', 'DELETE'
      )
    )
) as security_gate_preflight;
