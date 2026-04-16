-- Phase 7 — schedule the calendar-sync Edge Function to run every 30 minutes.
--
-- Prerequisites (one-time, by the admin):
--   1. Deploy the calendar-sync Edge Function (supabase/functions/calendar-sync).
--   2. Replace <PROJECT_REF>       with the project ref from your Supabase URL.
--   3. Replace <SERVICE_ROLE_KEY>  with the service-role key from
--      Project Settings → API. Inline it here as requested; rotate if leaked.
--
-- pg_cron + pg_net extensions must be enabled:
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'calendar-sync',
  '*/30 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calendar-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      )
    )
  $$
);

-- To unschedule later:
-- SELECT cron.unschedule('calendar-sync');
