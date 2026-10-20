-- SocialVerse initial schema: multi-tenant social media management.
-- Every table below is scoped to a single user via RLS — no user can ever
-- read or write another user's rows.
--
-- Every table, function, and trigger here is prefixed sv_ because this
-- Supabase project is shared with another, unrelated app that already owns
-- unprefixed names like profiles/connected_accounts/handle_new_user/
-- on_auth_user_created — reusing those would either fail outright (duplicate
-- table/trigger) or silently overwrite that app's trigger function body.

-- ============================================================
-- sv_profiles
-- ============================================================
CREATE TABLE public.sv_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text UNIQUE NOT NULL,
  avatar_url text,
  plan_tier text NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free','pro','business')),
  max_connected_accounts integer NOT NULL DEFAULT 4,
  max_scheduled_posts integer NOT NULL DEFAULT 10,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.sv_tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER sv_profiles_set_updated_at
BEFORE UPDATE ON public.sv_profiles
FOR EACH ROW EXECUTE FUNCTION public.sv_tg_set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up.
CREATE OR REPLACE FUNCTION public.sv_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sv_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sv_handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER sv_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sv_handle_new_user();

GRANT SELECT, UPDATE ON public.sv_profiles TO authenticated;
GRANT ALL ON public.sv_profiles TO service_role;

ALTER TABLE public.sv_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sv_profiles_select_own" ON public.sv_profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "sv_profiles_update_own" ON public.sv_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Self-service account deletion. SECURITY DEFINER so the (unprivileged)
-- authenticated role can delete its own auth.users row without ever holding
-- direct DELETE rights on that table — the function only ever touches
-- auth.uid(), never a caller-supplied id, so one user can only ever delete
-- themselves. Deleting the auth.users row cascades to sv_profiles, which
-- cascades to every other table's user_id FK, removing all of the user's
-- data.
--
-- NOTE: this also deletes the user's account in the OTHER app sharing this
-- Supabase project, since both apps' profile tables key off the same
-- auth.users row. That's an inherent consequence of sharing one auth system
-- across two apps, not something this function can scope away.
CREATE OR REPLACE FUNCTION public.sv_delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sv_delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sv_delete_own_account() TO authenticated;

-- ============================================================
-- sv_connected_accounts
-- ============================================================
CREATE TABLE public.sv_connected_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.sv_profiles(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook','instagram','youtube','linkedin')),
  platform_user_id text,
  platform_username text,
  platform_display_name text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[],
  is_active boolean NOT NULL DEFAULT true,
  profile_picture_url text,
  followers_count integer NOT NULL DEFAULT 0,
  following_count integer NOT NULL DEFAULT 0,
  posts_count integer NOT NULL DEFAULT 0,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, platform_user_id)
);

CREATE INDEX sv_idx_connected_accounts_user ON public.sv_connected_accounts(user_id);
CREATE INDEX sv_idx_connected_accounts_platform ON public.sv_connected_accounts(user_id, platform);

CREATE TRIGGER sv_connected_accounts_set_updated_at
BEFORE UPDATE ON public.sv_connected_accounts
FOR EACH ROW EXECUTE FUNCTION public.sv_tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sv_connected_accounts TO authenticated;
GRANT ALL ON public.sv_connected_accounts TO service_role;

ALTER TABLE public.sv_connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sv_connected_accounts_select_own" ON public.sv_connected_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sv_connected_accounts_insert_own" ON public.sv_connected_accounts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sv_connected_accounts_update_own" ON public.sv_connected_accounts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sv_connected_accounts_delete_own" ON public.sv_connected_accounts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- sv_posts
-- ============================================================
CREATE TABLE public.sv_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.sv_profiles(id) ON DELETE CASCADE,
  title text,
  content text NOT NULL,
  media_urls text[],
  platforms text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','publishing','published','partially_failed','failed')),
  scheduled_at timestamptz,
  published_at timestamptz,
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sv_idx_posts_user_status ON public.sv_posts(user_id, status);
CREATE INDEX sv_idx_posts_scheduled ON public.sv_posts(scheduled_at) WHERE status = 'scheduled';

CREATE TRIGGER sv_posts_set_updated_at
BEFORE UPDATE ON public.sv_posts
FOR EACH ROW EXECUTE FUNCTION public.sv_tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sv_posts TO authenticated;
GRANT ALL ON public.sv_posts TO service_role;

ALTER TABLE public.sv_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sv_posts_select_own" ON public.sv_posts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sv_posts_insert_own" ON public.sv_posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sv_posts_update_own" ON public.sv_posts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sv_posts_delete_own" ON public.sv_posts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- sv_post_platform_results
-- ============================================================
CREATE TABLE public.sv_post_platform_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.sv_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.sv_profiles(id) ON DELETE CASCADE,
  connected_account_id uuid REFERENCES public.sv_connected_accounts(id),
  platform text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','publishing','published','failed')),
  platform_post_id text,
  published_url text,
  error_message text,
  engagement_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sv_idx_post_results_post ON public.sv_post_platform_results(post_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sv_post_platform_results TO authenticated;
GRANT ALL ON public.sv_post_platform_results TO service_role;

ALTER TABLE public.sv_post_platform_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sv_post_platform_results_own" ON public.sv_post_platform_results
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- sv_analytics_snapshots
-- ============================================================
CREATE TABLE public.sv_analytics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.sv_profiles(id) ON DELETE CASCADE,
  connected_account_id uuid NOT NULL REFERENCES public.sv_connected_accounts(id) ON DELETE CASCADE,
  platform text NOT NULL,
  metric_date date NOT NULL,
  followers integer NOT NULL DEFAULT 0,
  following integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  reach integer NOT NULL DEFAULT 0,
  engagement_rate numeric(5,2) NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  saves integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  profile_views integer NOT NULL DEFAULT 0,
  video_views integer NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connected_account_id, metric_date)
);

CREATE INDEX sv_idx_analytics_user_date ON public.sv_analytics_snapshots(user_id, metric_date);
CREATE INDEX sv_idx_analytics_account_date ON public.sv_analytics_snapshots(connected_account_id, metric_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sv_analytics_snapshots TO authenticated;
GRANT ALL ON public.sv_analytics_snapshots TO service_role;

ALTER TABLE public.sv_analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sv_analytics_snapshots_own" ON public.sv_analytics_snapshots
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- sv_activity_log
-- ============================================================
CREATE TABLE public.sv_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.sv_profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sv_idx_activity_user ON public.sv_activity_log(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sv_activity_log TO authenticated;
GRANT ALL ON public.sv_activity_log TO service_role;

ALTER TABLE public.sv_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sv_activity_log_own" ON public.sv_activity_log
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Storage buckets: sv-media (post attachments) + sv-avatars (profile pictures)
-- Bucket ids are prefixed too — storage.buckets is shared per-project just
-- like every other table, and a generic "media"/"avatars" id could collide
-- with a bucket the other app creates later.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sv-media', 'sv-media', true, 524288000,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sv-avatars', 'sv-avatars', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "sv_media_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'sv-media');
CREATE POLICY "sv_media_insert_own" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sv-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "sv_media_update_own" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'sv-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "sv_media_delete_own" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'sv-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "sv_avatars_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'sv-avatars');
CREATE POLICY "sv_avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sv-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "sv_avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'sv-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "sv_avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'sv-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
