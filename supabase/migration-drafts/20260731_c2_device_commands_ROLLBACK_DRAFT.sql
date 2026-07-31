-- DRAFT ONLY - ISOLATED TEST DATABASES ONLY.
-- DO NOT RUN AGAINST PRODUCTION.
-- This rollback intentionally refuses to remove command history.

begin;

do $$
declare
  has_command_history boolean := false;
begin
  if to_regclass('public.device_commands') is not null then
    execute
      'select exists (select 1 from public.device_commands limit 1)'
      into has_command_history;

    if has_command_history then
      raise exception
        'C2 rollback refused: public.device_commands contains rows';
    end if;
  end if;
end
$$;

drop table if exists public.device_commands;

commit;
