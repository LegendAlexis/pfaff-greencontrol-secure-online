\set ON_ERROR_STOP on

\echo 'P1.3 PHASE 1: READ-ONLY AND IDENTITY PREFLIGHT'
BEGIN TRANSACTION READ ONLY;

SELECT CASE
  WHEN current_setting('transaction_read_only') = 'on' THEN 1
  ELSE 1 / 0
END AS read_only_gate;

SELECT json_build_object(
  'gate', 'P1.3 schema cleanup audit',
  'transaction_read_only', current_setting('transaction_read_only'),
  'database_name', current_database(),
  'server_version', current_setting('server_version')
) AS preflight;

\echo 'P1.3 PHASE 2: ROW COUNTS'
SELECT json_build_object(
  'greenhouses', (SELECT count(*) FROM public.greenhouses),
  'devices', (SELECT count(*) FROM public.devices),
  'greenhouse_users', (SELECT count(*) FROM public.greenhouse_users),
  'profiles', (SELECT count(*) FROM public.profiles),
  'sensor_readings', (SELECT count(*) FROM public.sensor_readings),
  'watering_schedule', (SELECT count(*) FROM public.watering_schedule),
  'manual_commands', (SELECT count(*) FROM public.manual_commands),
  'warning_logs', (SELECT count(*) FROM public.warning_logs),
  'notification_settings', (SELECT count(*) FROM public.notification_settings),
  'email_notification_log', (SELECT count(*) FROM public.email_notification_log)
) AS row_counts;

\echo 'P1.3 PHASE 3: RELATIONSHIP QUALITY'
SELECT json_build_object(
  'devices_without_greenhouse', (
    SELECT count(*)
    FROM public.devices child
    LEFT JOIN public.greenhouses parent ON parent.id = child.greenhouse_id
    WHERE parent.id IS NULL
  ),
  'greenhouse_users_without_greenhouse', (
    SELECT count(*)
    FROM public.greenhouse_users child
    LEFT JOIN public.greenhouses parent ON parent.id = child.greenhouse_id
    WHERE parent.id IS NULL
  ),
  'sensor_readings_without_greenhouse', (
    SELECT count(*)
    FROM public.sensor_readings child
    LEFT JOIN public.greenhouses parent ON parent.id = child.greenhouse_id
    WHERE parent.id IS NULL
  ),
  'watering_schedule_without_greenhouse', (
    SELECT count(*)
    FROM public.watering_schedule child
    LEFT JOIN public.greenhouses parent ON parent.id = child.greenhouse_id
    WHERE child.greenhouse_id IS NULL OR parent.id IS NULL
  ),
  'manual_commands_without_greenhouse', (
    SELECT count(*)
    FROM public.manual_commands child
    LEFT JOIN public.greenhouses parent ON parent.id = child.greenhouse_id
    WHERE child.greenhouse_id IS NULL OR parent.id IS NULL
  ),
  'warning_logs_without_greenhouse', (
    SELECT count(*)
    FROM public.warning_logs child
    LEFT JOIN public.greenhouses parent ON parent.id = child.greenhouse_id
    WHERE child.greenhouse_id IS NULL OR parent.id IS NULL
  ),
  'email_logs_with_missing_greenhouse', (
    SELECT count(*)
    FROM public.email_notification_log child
    LEFT JOIN public.greenhouses parent ON parent.id = child.greenhouse_id
    WHERE child.greenhouse_id IS NOT NULL AND parent.id IS NULL
  )
) AS relationship_quality;

\echo 'P1.3 PHASE 4: AUTH RELATIONSHIP QUALITY'
SELECT json_build_object(
  'profiles_without_auth_user', (
    SELECT count(*)
    FROM public.profiles child
    LEFT JOIN auth.users parent ON parent.id = child.id
    WHERE parent.id IS NULL
  ),
  'greenhouse_users_without_auth_user', (
    SELECT count(*)
    FROM public.greenhouse_users child
    LEFT JOIN auth.users parent ON parent.id = child.user_id
    WHERE parent.id IS NULL
  ),
  'notification_settings_without_auth_user', (
    SELECT count(*)
    FROM public.notification_settings child
    LEFT JOIN auth.users parent ON parent.id = child.user_id
    WHERE parent.id IS NULL
  ),
  'email_logs_with_missing_auth_user', (
    SELECT count(*)
    FROM public.email_notification_log child
    LEFT JOIN auth.users parent ON parent.id = child.user_id
    WHERE child.user_id IS NOT NULL AND parent.id IS NULL
  )
) AS auth_relationship_quality;

\echo 'P1.3 PHASE 5: LEGACY NOTIFICATION COLUMN DRIFT'
SELECT json_build_object(
  'enabled_mismatch', count(*) FILTER (
    WHERE enabled IS DISTINCT FROM email_enabled
  ),
  'recipient_mismatch', count(*) FILTER (
    WHERE lower(btrim(recipient_email)) IS DISTINCT FROM
      lower(btrim(email_address))
  ),
  'offline_mismatch', count(*) FILTER (
    WHERE notify_offline IS DISTINCT FROM offline_alerts
  ),
  'frost_mismatch', count(*) FILTER (
    WHERE notify_frost IS DISTINCT FROM frost_alerts
  ),
  'critical_mismatch', count(*) FILTER (
    WHERE notify_critical IS DISTINCT FROM critical_alerts
  )
) AS notification_column_drift
FROM public.notification_settings;

\echo 'P1.3 PHASE 6: COMMAND AND SCHEDULE QUALITY'
SELECT json_build_object(
  'window_command_rows', (
    SELECT count(*)
    FROM public.manual_commands
    WHERE roof_window_command IS TRUE OR wall_window_command IS TRUE
  ),
  'empty_command_rows', (
    SELECT count(*)
    FROM public.manual_commands
    WHERE roof_window_command IS NULL
      AND wall_window_command IS NULL
      AND watering_command IS NULL
      AND auto_mode IS NULL
  ),
  'schedule_missing_start', (
    SELECT count(*)
    FROM public.watering_schedule
    WHERE start_time IS NULL
  ),
  'schedule_nonpositive_duration', (
    SELECT count(*)
    FROM public.watering_schedule
    WHERE duration_minutes IS NULL OR duration_minutes <= 0
  ),
  'schedule_missing_enabled_state', (
    SELECT count(*)
    FROM public.watering_schedule
    WHERE enabled IS NULL
  )
) AS command_and_schedule_quality;

\echo 'P1.3 PHASE 7: METADATA GATES'
SELECT json_build_object(
  'auth_user_bootstrap_trigger_count', (
    SELECT count(*)
    FROM pg_catalog.pg_trigger trigger_record
    JOIN pg_catalog.pg_class relation
      ON relation.oid = trigger_record.tgrelid
    JOIN pg_catalog.pg_namespace namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'auth'
      AND relation.relname = 'users'
      AND trigger_record.tgname = 'on_auth_user_created'
      AND NOT trigger_record.tgisinternal
  ),
  'notification_delete_policy_count', (
    SELECT count(*)
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_settings'
      AND cmd = 'DELETE'
  ),
  'manual_commands_rls', (
    SELECT relation.relrowsecurity
    FROM pg_catalog.pg_class relation
    JOIN pg_catalog.pg_namespace namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'manual_commands'
  )
) AS metadata_gates;

\echo 'P1.3 PHASE 8: INDEX COVERAGE OBSERVATION'
SELECT json_build_object(
  'greenhouse_users_user_id_indexes', (
    SELECT count(*)
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'greenhouse_users'
      AND position('(user_id)' IN lower(indexdef)) > 0
  ),
  'sensor_readings_greenhouse_id_indexes', (
    SELECT count(*)
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'sensor_readings'
      AND position('(greenhouse_id' IN lower(indexdef)) > 0
  ),
  'watering_schedule_greenhouse_id_indexes', (
    SELECT count(*)
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'watering_schedule'
      AND position('(greenhouse_id' IN lower(indexdef)) > 0
  ),
  'warning_logs_greenhouse_id_indexes', (
    SELECT count(*)
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'warning_logs'
      AND position('(greenhouse_id' IN lower(indexdef)) > 0
  ),
  'email_log_user_or_greenhouse_indexes', (
    SELECT count(*)
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'email_notification_log'
      AND (
        position('(user_id' IN lower(indexdef)) > 0
        OR position('(greenhouse_id' IN lower(indexdef)) > 0
      )
  )
) AS index_coverage_observation;

\echo 'P1.3 AUDIT COMPLETED; NO CHANGES PERSISTED'
ROLLBACK;
