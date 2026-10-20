-- Makes "Schedule for later" actually publish at the scheduled time —
-- previously nothing ever checked for due posts, so they just sat at
-- status='scheduled' forever.
--
-- pg_cron fires every 5 minutes and calls the run-due-posts Edge Function
-- via pg_net, authenticated with a shared secret pulled from Vault at
-- execution time (never written into this file, or any migration) rather
-- than the project's service-role key, so this job's blast radius is
-- limited to exactly what run-due-posts does.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- The actual secret value is set separately (via CLI, not committed here);
-- this just declares the slot cron.schedule below reads from by name.
-- If it's missing, the DO block below is a no-op and cron doesn't get
-- scheduled — see the Vault section of the README for how to set it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'sv_cron_secret') THEN
    PERFORM cron.schedule(
      'sv-run-due-posts',
      '*/5 * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://igdbgaroizwqaphdhimd.supabase.co/functions/v1/run-due-posts',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sv_cron_secret')
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;
