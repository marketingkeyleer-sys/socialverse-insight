-- Replace the installation-specific URLs from 007/009 with Vault config.
-- No remote request is made unless both secrets have been configured.
CREATE FUNCTION public.sv_invoke_worker(worker text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE project_url text; cron_secret text;
BEGIN
  IF worker NOT IN ('run-due-posts', 'run-due-syncs') THEN RAISE EXCEPTION 'Invalid worker'; END IF;
  SELECT decrypted_secret INTO project_url FROM vault.decrypted_secrets WHERE name = 'sv_project_url';
  SELECT decrypted_secret INTO cron_secret FROM vault.decrypted_secrets WHERE name = 'sv_cron_secret';
  IF project_url IS NULL OR cron_secret IS NULL THEN RETURN NULL; END IF;
  RETURN net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/' || worker,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || cron_secret),
    body := '{}'::jsonb
  );
END $$;
REVOKE ALL ON FUNCTION public.sv_invoke_worker(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sv_invoke_worker(text) TO service_role;
SELECT cron.schedule('sv-run-due-posts', '*/5 * * * *', $$SELECT public.sv_invoke_worker('run-due-posts')$$);
SELECT cron.schedule('sv-run-due-syncs', '*/5 * * * *', $$SELECT public.sv_invoke_worker('run-due-syncs')$$);
SELECT cron.schedule('sv-expire-oauth', '*/10 * * * *',
  $$DELETE FROM public.sv_oauth_pending WHERE expires_at < now(); DELETE FROM public.sv_oauth_states WHERE expires_at < now()$$);
