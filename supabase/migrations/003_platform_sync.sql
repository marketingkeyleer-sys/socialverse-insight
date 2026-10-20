-- Real platform sync: stores the Facebook Page's own access token (distinct
-- from the user token captured at connect time — Insights and page-post
-- reads need the page token) and a table for posts pulled FROM the
-- connected platform, kept separate from sv_posts (posts authored IN
-- SocialVerse) since they're a different concept with a different lifecycle.

ALTER TABLE public.sv_connected_accounts ADD COLUMN page_access_token_ciphertext text;
ALTER TABLE public.sv_connected_accounts ADD COLUMN page_access_token_iv text;

CREATE TABLE public.sv_platform_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.sv_profiles(id) ON DELETE CASCADE,
  connected_account_id uuid NOT NULL REFERENCES public.sv_connected_accounts(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook','instagram','youtube','linkedin')),
  platform_post_id text NOT NULL,
  message text,
  media_url text,
  permalink_url text,
  posted_at timestamptz NOT NULL,
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  shares_count integer NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connected_account_id, platform_post_id)
);

CREATE INDEX sv_idx_platform_posts_account ON public.sv_platform_posts(connected_account_id, posted_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sv_platform_posts TO authenticated;
GRANT ALL ON public.sv_platform_posts TO service_role;

ALTER TABLE public.sv_platform_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sv_platform_posts_own" ON public.sv_platform_posts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
