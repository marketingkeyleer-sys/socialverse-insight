-- Reuse the existing server-side cron authorization without exposing it.
DO $$ DECLARE existing_command text; BEGIN
 SELECT command INTO existing_command FROM cron.job WHERE jobname='sv-run-due-posts' AND active;
 IF existing_command IS NULL OR position('/run-due-posts' in existing_command)=0 THEN RAISE EXCEPTION 'Existing authenticated publishing cron is required'; END IF;
 PERFORM cron.schedule('sv-content-campaigns','*/5 * * * *',replace(existing_command,'/run-due-posts','/run-content-campaigns'));
END $$;
