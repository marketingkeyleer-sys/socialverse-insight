-- Per-post reach/impressions, fetched from Facebook's post-level Insights
-- edge (distinct from the page-level Insights already backfilled into
-- sv_analytics_snapshots). Nullable because it's best-effort — if Meta
-- rejects this metric for a given post, the row just keeps NULL rather than
-- failing the whole sync.
ALTER TABLE public.sv_platform_posts ADD COLUMN impressions integer;
ALTER TABLE public.sv_platform_posts ADD COLUMN reach integer;
