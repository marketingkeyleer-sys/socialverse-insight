-- YouTube's core per-video metric is view count, which is a genuinely
-- different thing from Facebook's "impressions" (shown vs. watched) — kept
-- as its own column rather than overloading impressions with a mismatched
-- meaning for a different platform.
ALTER TABLE public.sv_platform_posts ADD COLUMN views_count integer;
