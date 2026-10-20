-- Lets the posts table show what kind of post each one actually is
-- (image/video/carousel/text-only) instead of just a caption and a maybe-
-- present thumbnail.
ALTER TABLE public.sv_platform_posts ADD COLUMN media_type text;
