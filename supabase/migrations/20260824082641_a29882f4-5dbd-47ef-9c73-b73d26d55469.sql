CREATE TABLE public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  media_url text,
  media_type text check (media_type in ('image','video')),
  media_path text,
  status text not null default 'scheduled',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE public.post_targets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.scheduled_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  connected_account_id uuid not null references public.connected_accounts(id) on delete cascade,
  platform social_platform not null,
  status text not null default 'pending',
  scheduled_at timestamptz not null default now(),
  attempts integer not null default 0,
  error_message text,
  provider_post_id text,
  provider_post_url text,
  locked_at timestamptz,
  published_at timestamptz,
  platform_options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX post_targets_due_idx ON public.post_targets (status, scheduled_at);
CREATE INDEX post_targets_post_id_idx ON public.post_targets (post_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_posts TO authenticated;
GRANT ALL ON public.scheduled_posts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_targets TO authenticated;
GRANT ALL ON public.post_targets TO service_role;

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY sp_select_own ON public.scheduled_posts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY sp_insert_own ON public.scheduled_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY sp_update_own ON public.scheduled_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY sp_delete_own ON public.scheduled_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY pt_select_own ON public.post_targets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY pt_insert_own ON public.post_targets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY pt_update_own ON public.post_targets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY pt_delete_own ON public.post_targets FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER scheduled_posts_set_updated_at BEFORE UPDATE ON public.scheduled_posts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER post_targets_set_updated_at BEFORE UPDATE ON public.post_targets FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();