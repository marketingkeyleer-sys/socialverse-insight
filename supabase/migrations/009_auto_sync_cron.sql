-- Auto-syncs every connected account on its own sync_interval_minutes
-- (default 30) instead of requiring a manual "Sync now" click. Same
-- pg_cron + pg_net + Vault pattern as 007_scheduled_publish_cron.sql —
-- checks every 5 minutes for accounts whose interval has elapsed; the
-- actual "is it due yet" logic lives in run-due-syncs, not here.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'sv_cron_secret') THEN
    PERFORM cron.schedule(
      'sv-run-due-syncs',
      '*/5 * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://igdbgaroizwqaphdhimd.supabase.co/functions/v1/run-due-syncs',
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
