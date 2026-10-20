-- Additive migration: preserve existing accounts and brand conventions.
-- Auth users can predate SocialVerse in a shared Supabase project. The
-- signup trigger only covers NEW auth users; backfill missing app profiles.
INSERT INTO public.sv_profiles (id, email, full_name)
SELECT id, email, coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
FROM auth.users WHERE email IS NOT NULL ON CONFLICT DO NOTHING;

CREATE TABLE public.sv_oauth_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  brand_id uuid REFERENCES public.sv_brands(id) ON DELETE SET NULL,
  accounts jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);
ALTER TABLE public.sv_oauth_pending ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sv_oauth_pending FROM anon, authenticated;
GRANT ALL ON public.sv_oauth_pending TO service_role;
CREATE INDEX sv_oauth_pending_expiry ON public.sv_oauth_pending(expires_at);

-- Atomic confirmation, serialization per owner, replay protection and token
-- preservation when the provider omits a refresh token on reauthorization.
CREATE FUNCTION public.sv_confirm_oauth(request_id uuid, owner_id uuid, selected_ids text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pending public.sv_oauth_pending; account jsonb; total integer := 0; added integer; max_accounts integer;
BEGIN
  PERFORM 1 FROM public.sv_profiles WHERE id = owner_id FOR UPDATE;
  SELECT * INTO pending FROM public.sv_oauth_pending
    WHERE id = request_id AND user_id = owner_id AND expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Connection request not found or expired'; END IF;
  IF coalesce(cardinality(selected_ids), 0) = 0 OR cardinality(selected_ids) <> (SELECT count(DISTINCT x) FROM unnest(selected_ids) x)
    THEN RAISE EXCEPTION 'Select at least one authorized account without duplicates'; END IF;
  IF pending.brand_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sv_brands WHERE id = pending.brand_id AND user_id = owner_id)
    THEN RAISE EXCEPTION 'Brand not found'; END IF;
  IF pending.brand_id IS NOT NULL AND cardinality(selected_ids) > 1 THEN
    RAISE EXCEPTION 'Select one account for this brand; connect additional accounts to another brand or Ungrouped';
  END IF;
  SELECT count(*) INTO total FROM jsonb_array_elements(pending.accounts) a WHERE a->>'platform_user_id' = ANY(selected_ids);
  IF total <> cardinality(selected_ids) THEN RAISE EXCEPTION 'Unauthorized account selection'; END IF;
  SELECT count(*) INTO added FROM jsonb_array_elements(pending.accounts) a
    WHERE a->>'platform_user_id' = ANY(selected_ids) AND NOT EXISTS (
      SELECT 1 FROM sv_connected_accounts c WHERE c.user_id = owner_id AND c.platform = pending.platform AND c.platform_user_id = a->>'platform_user_id');
  SELECT max_connected_accounts INTO max_accounts FROM sv_profiles WHERE id = owner_id;
  IF (SELECT count(*) FROM sv_connected_accounts WHERE user_id = owner_id) + added > max_accounts THEN
    RAISE EXCEPTION 'Account limit reached';
  END IF;
  FOR account IN SELECT value FROM jsonb_array_elements(pending.accounts) WHERE value->>'platform_user_id' = ANY(selected_ids) LOOP
    INSERT INTO sv_connected_accounts (user_id, platform, platform_user_id, platform_username, platform_display_name,
      access_token_ciphertext, token_iv, refresh_token_ciphertext, refresh_iv, page_access_token_ciphertext, page_access_token_iv,
      token_expires_at, scopes, is_active, profile_picture_url, followers_count, following_count, posts_count, brand_id)
    SELECT owner_id, pending.platform, r.platform_user_id, r.platform_username, r.platform_display_name,
      r.access_token_ciphertext, r.token_iv, r.refresh_token_ciphertext, r.refresh_iv, r.page_access_token_ciphertext, r.page_access_token_iv,
      r.token_expires_at, r.scopes, true, r.profile_picture_url, r.followers_count, r.following_count, r.posts_count, pending.brand_id
    FROM jsonb_populate_record(NULL::sv_connected_accounts, account) r
    ON CONFLICT (user_id, platform, platform_user_id) DO UPDATE SET
      platform_username = EXCLUDED.platform_username, platform_display_name = EXCLUDED.platform_display_name,
      access_token_ciphertext = EXCLUDED.access_token_ciphertext, token_iv = EXCLUDED.token_iv,
      refresh_token_ciphertext = coalesce(EXCLUDED.refresh_token_ciphertext, sv_connected_accounts.refresh_token_ciphertext),
      refresh_iv = coalesce(EXCLUDED.refresh_iv, sv_connected_accounts.refresh_iv),
      page_access_token_ciphertext = EXCLUDED.page_access_token_ciphertext, page_access_token_iv = EXCLUDED.page_access_token_iv,
      token_expires_at = EXCLUDED.token_expires_at, scopes = EXCLUDED.scopes, is_active = true,
      profile_picture_url = EXCLUDED.profile_picture_url,
      brand_id = coalesce(EXCLUDED.brand_id, sv_connected_accounts.brand_id);
  END LOOP;
  DELETE FROM sv_oauth_pending WHERE id = request_id;
  DELETE FROM sv_oauth_pending WHERE expires_at < now();
  RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.sv_confirm_oauth(uuid, uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sv_confirm_oauth(uuid, uuid, text[]) TO service_role;

-- RLS on a child row alone does not check ownership of its referenced parent.
CREATE FUNCTION public.sv_check_reference_owner() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ref_id uuid; parent_owner uuid; field text := TG_ARGV[0]; parent_table text := TG_ARGV[1];
BEGIN
  ref_id := (to_jsonb(NEW)->>field)::uuid;
  IF ref_id IS NULL THEN RETURN NEW; END IF;
  EXECUTE format('SELECT user_id FROM public.%I WHERE id = $1', parent_table) INTO parent_owner USING ref_id;
  IF parent_owner IS DISTINCT FROM NEW.user_id THEN RAISE EXCEPTION 'Referenced record belongs to another user' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sv_account_brand_owner BEFORE INSERT OR UPDATE ON sv_connected_accounts
  FOR EACH ROW EXECUTE FUNCTION sv_check_reference_owner('brand_id', 'sv_brands');
CREATE TRIGGER sv_result_post_owner BEFORE INSERT OR UPDATE ON sv_post_platform_results
  FOR EACH ROW EXECUTE FUNCTION sv_check_reference_owner('post_id', 'sv_posts');
CREATE TRIGGER sv_result_account_owner BEFORE INSERT OR UPDATE ON sv_post_platform_results
  FOR EACH ROW EXECUTE FUNCTION sv_check_reference_owner('connected_account_id', 'sv_connected_accounts');
CREATE TRIGGER sv_snapshot_account_owner BEFORE INSERT OR UPDATE ON sv_analytics_snapshots
  FOR EACH ROW EXECUTE FUNCTION sv_check_reference_owner('connected_account_id', 'sv_connected_accounts');
CREATE TRIGGER sv_platform_post_account_owner BEFORE INSERT OR UPDATE ON sv_platform_posts
  FOR EACH ROW EXECUTE FUNCTION sv_check_reference_owner('connected_account_id', 'sv_connected_accounts');

-- Users may edit profile details, but cannot grant themselves paid limits.
REVOKE UPDATE ON public.sv_profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, timezone, onboarding_completed) ON public.sv_profiles TO authenticated;
