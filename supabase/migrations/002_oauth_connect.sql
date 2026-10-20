-- Real OAuth connect flow support.
--
-- 1) sv_connected_accounts.access_token/refresh_token were plaintext text
--    columns — upgraded here to encrypted ciphertext + IV pairs, matching
--    how a token should actually be stored at rest.
-- 2) sv_oauth_states is a short-lived, one-time-use table that ties a redirect
--    back from Facebook/Google/LinkedIn to the user who started the flow,
--    and prevents CSRF / replay.
--
-- Table/index names are sv_-prefixed for the same reason as 001: this
-- Supabase project is shared with another app that already has its own
-- (differently-shaped) connected_accounts and oauth_states tables.

ALTER TABLE public.sv_connected_accounts RENAME COLUMN access_token TO access_token_ciphertext;
ALTER TABLE public.sv_connected_accounts RENAME COLUMN refresh_token TO refresh_token_ciphertext;
ALTER TABLE public.sv_connected_accounts ADD COLUMN token_iv text;
ALTER TABLE public.sv_connected_accounts ADD COLUMN refresh_iv text;

CREATE TABLE public.sv_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook','instagram','youtube','linkedin')),
  code_verifier text,
  redirect_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

CREATE INDEX sv_idx_oauth_states_user ON public.sv_oauth_states(user_id);
CREATE INDEX sv_idx_oauth_states_expiry ON public.sv_oauth_states(expires_at);

-- Only the service-role key (used exclusively by the oauth-start/oauth-callback
-- Edge Functions) ever touches this table — end users never read or write it
-- directly, so no authenticated-role grants or RLS policies are needed beyond
-- enabling RLS itself as a default-deny.
GRANT ALL ON public.sv_oauth_states TO service_role;
ALTER TABLE public.sv_oauth_states ENABLE ROW LEVEL SECURITY;
