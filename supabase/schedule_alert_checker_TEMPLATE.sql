-- Erst ausführen, NACHDEM die neue App online auf Vercel ist.
-- Ersetze die beiden Platzhalter ohne < >.
-- Supabase Cron ruft den geschützten Prüf-Endpunkt jede Minute auf.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('pfaff-greencontrol-alert-check')
where exists (
  select 1 from cron.job where jobname = 'pfaff-greencontrol-alert-check'
);

select cron.schedule(
  'pfaff-greencontrol-alert-check',
  '* * * * *',
  $$
  select net.http_post(
    url := '<DEINE_VERCEL_URL>/api/alerts/check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <DEIN_ALERT_CRON_SECRET>'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
