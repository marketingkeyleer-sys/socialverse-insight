-- engagement_rate numeric(5,2) only allows up to 999.99 — a real page with a
-- small follower base can produce a computed engagement percentage well
-- above that (e.g. 79 followers, 400 engagements on one post = ~500%, and
-- spikes go higher), which overflowed on insert. Widened to allow up to
-- 99999.99; the sync function also clamps its own calculation defensively.
ALTER TABLE public.sv_analytics_snapshots ALTER COLUMN engagement_rate TYPE numeric(7,2);
