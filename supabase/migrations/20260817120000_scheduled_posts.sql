-- Scheduled auto-posting: composed posts + per-platform publish targets.

CREATE TYPE public.post_status AS ENUM ('draft','scheduled','publishing','published','partial','failed','canceled');
CREATE TYPE public.target_status AS ENUM ('pending','publishing','published','failed','canceled');

-- Header row: one composed post, possibly targeting several platforms.
CREATE TABLE public.scheduled_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image','video')),
  media_path TEXT,
  status public.post_status NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX scheduled_posts_user_idx ON public.scheduled_posts(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_posts TO authenticated;
GRANT ALL ON public.scheduled_posts TO service_role;

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sp_select_own" ON public.scheduled_posts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sp_insert_own" ON public.scheduled_posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sp_update_own" ON public.scheduled_posts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sp_delete_own" ON public.scheduled_posts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER scheduled_posts_set_updated_at
BEFORE UPDATE ON public.scheduled_posts
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- One row per platform a post targets; independent publish lifecycle each.
CREATE TABLE public.post_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.scheduled_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_account_id UUID NOT NULL REFERENCES public.connected_accounts(id) ON DELETE CASCADE,
  platform public.social_platform NOT NULL,
  status public.target_status NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ,
  provider_post_id TEXT,
  provider_post_url TEXT,
  error_message TEXT,
  platform_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, connected_account_id)
);

CREATE INDEX post_targets_post_idx ON public.post_targets(post_id);
CREATE INDEX post_targets_user_idx ON public.post_targets(user_id);
CREATE INDEX post_targets_due_idx ON public.post_targets(status, scheduled_at) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_targets TO authenticated;
GRANT ALL ON public.post_targets TO service_role;

ALTER TABLE public.post_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pt_select_own" ON public.post_targets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "pt_insert_own" ON public.post_targets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pt_update_own" ON public.post_targets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "pt_delete_own" ON public.post_targets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER post_targets_set_updated_at
BEFORE UPDATE ON public.post_targets
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Media bucket. Public-read is required: Meta's Graph API and LinkedIn's asset
-- upload both fetch media by URL from the open internet and cannot authenticate
-- against Supabase Storage RLS, so anything uploaded here is reachable by anyone
-- with the (unguessable, UUID-keyed) URL.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-media',
  'post-media',
  true,
  524288000,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime']
);

CREATE POLICY "post_media_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'post-media');

CREATE POLICY "post_media_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "post_media_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "post_media_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);
