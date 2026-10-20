-- sv_brands lets a single user group connected accounts under separate
-- brand identities (e.g. "RobotVerse" and "Keyleerkart") instead of every
-- connected account living in one flat pool. brand_id is nullable on
-- sv_connected_accounts and sv_oauth_states so every account connected
-- before this migration keeps working unchanged — the UI shows those as an
-- "Ungrouped" section rather than breaking or requiring a backfill.
CREATE TABLE public.sv_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sv_idx_brands_user ON public.sv_brands(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sv_brands TO authenticated;
GRANT ALL ON public.sv_brands TO service_role;

ALTER TABLE public.sv_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sv_brands_select_own" ON public.sv_brands
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sv_brands_insert_own" ON public.sv_brands
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sv_brands_update_own" ON public.sv_brands
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sv_brands_delete_own" ON public.sv_brands
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.sv_connected_accounts
  ADD COLUMN brand_id uuid REFERENCES public.sv_brands(id) ON DELETE SET NULL;
CREATE INDEX sv_idx_connected_accounts_brand ON public.sv_connected_accounts(brand_id);

-- oauth-start stashes the brand the user picked before redirecting to the
-- provider; oauth-callback reads it back off the state row so every
-- identity a single login grants (e.g. 2 Facebook Pages in one OAuth
-- round-trip) is tagged with the same brand.
ALTER TABLE public.sv_oauth_states
  ADD COLUMN brand_id uuid REFERENCES public.sv_brands(id) ON DELETE SET NULL;
