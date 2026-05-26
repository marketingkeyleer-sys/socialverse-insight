
-- Platform enum
CREATE TYPE public.social_platform AS ENUM ('instagram','facebook','linkedin','youtube','tiktok','x');

-- Connected accounts
CREATE TABLE public.connected_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform public.social_platform NOT NULL,
  provider_account_id TEXT NOT NULL,
  account_handle TEXT,
  display_name TEXT,
  avatar_url TEXT,
  access_token_ciphertext TEXT NOT NULL,
  refresh_token_ciphertext TEXT,
  token_iv TEXT NOT NULL,
  refresh_iv TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, provider_account_id)
);

CREATE INDEX connected_accounts_user_idx ON public.connected_accounts(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.connected_accounts TO authenticated;
GRANT ALL ON public.connected_accounts TO service_role;

ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_select_own" ON public.connected_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ca_insert_own" ON public.connected_accounts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ca_update_own" ON public.connected_accounts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ca_delete_own" ON public.connected_accounts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Short-lived OAuth handshake state
CREATE TABLE public.oauth_states (
  state TEXT NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform public.social_platform NOT NULL,
  code_verifier TEXT,
  redirect_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
);

CREATE INDEX oauth_states_user_idx ON public.oauth_states(user_id);
CREATE INDEX oauth_states_expiry_idx ON public.oauth_states(expires_at);

GRANT SELECT, INSERT, DELETE ON public.oauth_states TO authenticated;
GRANT ALL ON public.oauth_states TO service_role;

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "os_select_own" ON public.oauth_states
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "os_insert_own" ON public.oauth_states
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "os_delete_own" ON public.oauth_states
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER connected_accounts_set_updated_at
BEFORE UPDATE ON public.connected_accounts
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
