-- Full ad campaign manager: campaigns -> ad sets -> ads, mirroring Meta's
-- own hierarchy so each level maps 1:1 to a real Marketing API object.
-- Meta (Facebook + Instagram) only for now — both run through the same Ad
-- Account and Marketing API, unlike Google Ads / LinkedIn Ads which are
-- entirely separate systems (own OAuth, own account model, own approval
-- process) and aren't wired up yet.
--
-- Everything defaults to a paused/draft state and nothing here can spend
-- real money until (a) Meta approves the ads_management permission for
-- this app, and (b) the user explicitly activates a campaign — creating a
-- campaign never auto-activates it.

CREATE TYPE public.sv_ad_campaign_status AS ENUM ('draft', 'active', 'paused', 'completed', 'failed');
CREATE TYPE public.sv_ad_objective AS ENUM (
  'OUTCOME_AWARENESS', 'OUTCOME_ENGAGEMENT', 'OUTCOME_TRAFFIC', 'OUTCOME_LEADS', 'OUTCOME_SALES'
);

-- One row per Meta Ad Account the user has picked to use — discovered via
-- /me/adaccounts, not something we create.
CREATE TABLE public.sv_ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_account_id uuid NOT NULL REFERENCES public.sv_connected_accounts(id) ON DELETE CASCADE,
  meta_ad_account_id text NOT NULL, -- e.g. "act_1234567890"
  name text,
  currency text,
  account_status int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, meta_ad_account_id)
);

CREATE TABLE public.sv_ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.sv_ad_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  objective public.sv_ad_objective NOT NULL,
  status public.sv_ad_campaign_status NOT NULL DEFAULT 'draft',
  meta_campaign_id text, -- null until actually created on Meta's side
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sv_ad_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.sv_ad_campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  daily_budget_cents int NOT NULL CHECK (daily_budget_cents > 0),
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz, -- null = runs until manually paused
  targeting jsonb NOT NULL DEFAULT '{}', -- {age_min, age_max, genders[], countries[]}
  status public.sv_ad_campaign_status NOT NULL DEFAULT 'draft',
  meta_adset_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sv_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_set_id uuid NOT NULL REFERENCES public.sv_ad_sets(id) ON DELETE CASCADE,
  name text NOT NULL,
  -- Boost an existing post (post_id set) or run standalone creative (fields
  -- below) — mutually exclusive in practice, both nullable so either works.
  post_id uuid REFERENCES public.sv_posts(id) ON DELETE SET NULL,
  headline text,
  body text,
  media_url text,
  destination_url text,
  call_to_action text,
  status public.sv_ad_campaign_status NOT NULL DEFAULT 'draft',
  meta_ad_id text,
  error_message text,
  -- Populated by a manual "sync performance" fetch, not a background cron —
  -- ad spend data doesn't need to be as fresh as organic post metrics.
  spend_cents int,
  impressions int,
  clicks int,
  reach int,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER sv_tg_ad_campaigns_updated_at BEFORE UPDATE ON public.sv_ad_campaigns
FOR EACH ROW EXECUTE FUNCTION public.sv_tg_set_updated_at();
CREATE TRIGGER sv_tg_ad_sets_updated_at BEFORE UPDATE ON public.sv_ad_sets
FOR EACH ROW EXECUTE FUNCTION public.sv_tg_set_updated_at();
CREATE TRIGGER sv_tg_ads_updated_at BEFORE UPDATE ON public.sv_ads
FOR EACH ROW EXECUTE FUNCTION public.sv_tg_set_updated_at();

CREATE INDEX sv_ad_campaigns_ad_account_id_idx ON public.sv_ad_campaigns(ad_account_id);
CREATE INDEX sv_ad_sets_campaign_id_idx ON public.sv_ad_sets(campaign_id);
CREATE INDEX sv_ads_ad_set_id_idx ON public.sv_ads(ad_set_id);

ALTER TABLE public.sv_ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sv_ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sv_ad_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sv_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sv_ad_accounts_select_own" ON public.sv_ad_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sv_ad_accounts_insert_own" ON public.sv_ad_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sv_ad_accounts_delete_own" ON public.sv_ad_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "sv_ad_campaigns_select_own" ON public.sv_ad_campaigns FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sv_ad_campaigns_insert_own" ON public.sv_ad_campaigns FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sv_ad_campaigns_update_own" ON public.sv_ad_campaigns FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sv_ad_campaigns_delete_own" ON public.sv_ad_campaigns FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "sv_ad_sets_select_own" ON public.sv_ad_sets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sv_ad_sets_insert_own" ON public.sv_ad_sets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sv_ad_sets_update_own" ON public.sv_ad_sets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sv_ad_sets_delete_own" ON public.sv_ad_sets FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "sv_ads_select_own" ON public.sv_ads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sv_ads_insert_own" ON public.sv_ads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sv_ads_update_own" ON public.sv_ads FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sv_ads_delete_own" ON public.sv_ads FOR DELETE TO authenticated USING (auth.uid() = user_id);
