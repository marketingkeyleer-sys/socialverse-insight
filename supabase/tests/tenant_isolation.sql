-- Run only against a disposable/staging database with migrations 001–022.
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/tenant_isolation.sql
-- All fixtures and changes roll back. No pgTAP extension required.
BEGIN;
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('10000000-0000-4000-8000-000000000001', 'sv-a@tenant-isolation.invalid', '{}'),
  ('10000000-0000-4000-8000-000000000002', 'sv-b@tenant-isolation.invalid', '{}');
INSERT INTO public.sv_brands (id, user_id, name) VALUES
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'B brand');
INSERT INTO public.sv_connected_accounts (id, user_id, platform, platform_user_id) VALUES
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'facebook', 'a-page'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'facebook', 'b-page');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.sv_connected_accounts) <> 1 THEN RAISE EXCEPTION 'A can see another user account'; END IF;
  IF EXISTS (SELECT 1 FROM public.sv_brands) THEN RAISE EXCEPTION 'A can see B brand'; END IF;
  IF has_function_privilege('authenticated', 'public.sv_confirm_oauth(uuid,uuid,text[])', 'EXECUTE') THEN RAISE EXCEPTION 'OAuth confirmation RPC is exposed'; END IF;
END $$;
DO $$ BEGIN
  BEGIN
    UPDATE public.sv_connected_accounts SET brand_id = '20000000-0000-4000-8000-000000000002'
      WHERE id = '30000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Cross-owner brand accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.sv_posts (user_id, content, platforms, connected_account_ids)
      VALUES (auth.uid(), 'Forbidden target', ARRAY['facebook'], ARRAY['30000000-0000-4000-8000-000000000002'::uuid]);
    RAISE EXCEPTION 'Cross-owner post target accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.sv_inbox_state (user_id, connected_account_id, conversation_id, note)
      VALUES (auth.uid(), '30000000-0000-4000-8000-000000000002', 'thread-b', 'Forbidden note');
    RAISE EXCEPTION 'Cross-owner inbox reference accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.sv_profiles SET plan_tier = 'business' WHERE id = auth.uid();
    RAISE EXCEPTION 'Self-service privilege escalation accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.sv_connected_accounts) <> 1 THEN RAISE EXCEPTION 'B can see another user account'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sv_brands WHERE name = 'B brand') THEN RAISE EXCEPTION 'B cannot access own brand'; END IF;
END $$;
RESET ROLE;

-- Exercise real confirmation SQL and refresh-token preservation.
INSERT INTO public.sv_oauth_pending (id, user_id, platform, accounts) VALUES
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'youtube',
  '[{"platform_user_id":"yt-a","access_token_ciphertext":"encrypted-1","token_iv":"iv-1","refresh_token_ciphertext":"refresh-1","refresh_iv":"refresh-iv","followers_count":0,"following_count":0,"posts_count":0}]');
SELECT public.sv_confirm_oauth('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', ARRAY['yt-a']);
INSERT INTO public.sv_oauth_pending (id, user_id, platform, accounts) VALUES
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'youtube',
  '[{"platform_user_id":"yt-a","access_token_ciphertext":"encrypted-2","token_iv":"iv-2","followers_count":0,"following_count":0,"posts_count":0}]');
SELECT public.sv_confirm_oauth('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', ARRAY['yt-a']);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM sv_connected_accounts WHERE platform_user_id = 'yt-a' AND access_token_ciphertext = 'encrypted-2' AND refresh_token_ciphertext = 'refresh-1') THEN
    RAISE EXCEPTION 'Reconnection lost refresh credentials'; END IF;
  BEGIN
    PERFORM public.sv_confirm_oauth('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', ARRAY['yt-a']);
    RAISE EXCEPTION 'Replayed confirmation succeeded' USING ERRCODE = 'XX000';
  EXCEPTION WHEN raise_exception THEN NULL; END;
END $$;
ROLLBACK;
