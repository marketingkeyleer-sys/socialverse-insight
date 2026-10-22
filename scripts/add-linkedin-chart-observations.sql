-- Additive deployment. NULL preserves the legacy metric coverage convention.
ALTER TABLE public.sv_analytics_snapshots ADD COLUMN IF NOT EXISTS available_metrics text[];
-- Seed only the actual last sync observation, never backfill invented history.
INSERT INTO public.sv_analytics_snapshots(user_id,connected_account_id,platform,metric_date,followers,fetched_at,available_metrics)
SELECT user_id,id,'linkedin_page',(last_synced_at AT TIME ZONE 'UTC')::date,followers_count,last_synced_at,ARRAY['followers']
FROM public.sv_connected_accounts
WHERE platform='linkedin_page' AND scopes @> ARRAY['socialverse:upload-post']::text[] AND last_synced_at IS NOT NULL AND followers_count IS NOT NULL
ON CONFLICT(connected_account_id,metric_date) DO NOTHING;
