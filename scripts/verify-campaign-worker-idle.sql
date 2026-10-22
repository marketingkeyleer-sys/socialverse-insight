-- Probe the deployed worker only when no real plan is active. The existing
-- cron authorization stays inside the database and is never returned.
DO $$ DECLARE task_command text; task_request bigint; BEGIN
 IF EXISTS(SELECT 1 FROM public.sv_content_campaigns WHERE status='active') THEN RAISE EXCEPTION 'Idle worker verification requires no active campaigns'; END IF;
 SELECT command INTO task_command FROM cron.job WHERE jobname='sv-content-campaigns' AND active;
 IF task_command IS NULL THEN RAISE EXCEPTION 'Planner cron is not active'; END IF;
 EXECUTE task_command INTO task_request;
 PERFORM set_config('socialverse.worker_probe',task_request::text,false);
END $$;
SELECT current_setting('socialverse.worker_probe')::bigint AS request_id;
