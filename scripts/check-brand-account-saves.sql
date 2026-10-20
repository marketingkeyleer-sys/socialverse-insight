-- Live save-path verification. All users, brands, accounts, and changes in
-- this transaction are temporary and are ROLLED BACK. No emails or HTTP
-- requests are sent and existing rows are not changed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $test$
DECLARE
  user_a uuid := gen_random_uuid(); user_b uuid := gen_random_uuid();
  brand_a uuid; brand_b uuid; account_a uuid; pending_id uuid;
  identity_a text := 'rolled-back-page-' || gen_random_uuid();
  identity_b text := 'rolled-back-page-' || gen_random_uuid();
  result_count integer; observed uuid;
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    (user_a, 'brand-test-' || user_a || '@example.invalid', '{"full_name":"Rollback Test A"}'),
    (user_b, 'brand-test-' || user_b || '@example.invalid', '{"full_name":"Rollback Test B"}');
  IF (SELECT count(*) FROM public.sv_profiles WHERE id IN (user_a,user_b)) <> 2 THEN
    RAISE EXCEPTION 'Signup trigger failed to create both profiles'; END IF;

  PERFORM set_config('request.jwt.claim.sub', user_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',user_a,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.sv_brands (user_id,name) VALUES (user_a,'Rollback Brand A') RETURNING id INTO brand_a;
  UPDATE public.sv_brands SET name='Rollback Brand A renamed' WHERE id=brand_a RETURNING id INTO observed;
  IF observed IS DISTINCT FROM brand_a THEN RAISE EXCEPTION 'Own brand rename failed'; END IF;
  INSERT INTO public.sv_connected_accounts (user_id,platform,platform_user_id,brand_id)
    VALUES (user_a,'facebook',identity_a,brand_a) RETURNING id INTO account_a;
  IF NOT EXISTS (SELECT 1 FROM public.sv_connected_accounts WHERE id=account_a AND brand_id=brand_a) THEN
    RAISE EXCEPTION 'Account insert/read-back failed'; END IF;
  BEGIN
    INSERT INTO public.sv_connected_accounts (user_id,platform,platform_user_id,brand_id)
      VALUES (user_a,'facebook',identity_b,brand_a);
    RAISE EXCEPTION 'Duplicate brand/platform was accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub',user_b::text,true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',user_b,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.sv_brands(user_id,name) VALUES (user_b,'Rollback Brand B') RETURNING id INTO brand_b;
  IF EXISTS(SELECT 1 FROM public.sv_brands WHERE id=brand_a) THEN RAISE EXCEPTION 'Foreign brand is visible'; END IF;
  BEGIN
    INSERT INTO public.sv_connected_accounts(user_id,platform,platform_user_id,brand_id)
      VALUES (user_b,'facebook',identity_b,brand_a);
    RAISE EXCEPTION 'Foreign brand attachment was accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO public.sv_connected_accounts(user_id,platform,platform_user_id,brand_id)
    VALUES (user_b,'facebook',identity_a,brand_b);
  RESET ROLE;

  -- Real confirmation RPC must update the SAME account for reconnection.
  pending_id := gen_random_uuid();
  INSERT INTO public.sv_oauth_pending(id,user_id,platform,brand_id,accounts)
    VALUES (pending_id,user_a,'facebook',brand_a,jsonb_build_array(jsonb_build_object(
      'platform_user_id',identity_a,'access_token_ciphertext','TEST-ENCRYPTED-TOKEN',
      'token_iv','TEST-IV','platform_display_name','Reconnected page',
      'followers_count',0,'following_count',0,'posts_count',0)));
  result_count := public.sv_confirm_oauth(pending_id,user_a,ARRAY[identity_a]);
  IF result_count <> 1 OR (SELECT count(*) FROM public.sv_connected_accounts WHERE user_id=user_a AND platform_user_id=identity_a) <> 1 THEN
    RAISE EXCEPTION 'Reconnection duplicated or failed to save account'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.sv_connected_accounts WHERE id=account_a AND access_token_ciphertext='TEST-ENCRYPTED-TOKEN') THEN
    RAISE EXCEPTION 'Reconnection did not preserve the account ID'; END IF;

  -- Saving a second Facebook Page into the occupied brand must fail cleanly.
  pending_id := gen_random_uuid();
  INSERT INTO public.sv_oauth_pending(id,user_id,platform,brand_id,accounts)
    VALUES(pending_id,user_a,'facebook',brand_a,jsonb_build_array(jsonb_build_object(
      'platform_user_id',identity_b,'access_token_ciphertext','TEST-TOKEN','token_iv','TEST-IV',
      'followers_count',0,'following_count',0,'posts_count',0)));
  BEGIN
    PERFORM public.sv_confirm_oauth(pending_id,user_a,ARRAY[identity_b]);
    RAISE EXCEPTION 'Occupied brand was silently overwritten' USING ERRCODE='XX000';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  IF NOT EXISTS(SELECT 1 FROM public.sv_oauth_pending WHERE id=pending_id) THEN
    RAISE EXCEPTION 'Failed confirmation lost the retryable request'; END IF;

  -- Removing a temporary brand must preserve its connected account.
  PERFORM set_config('request.jwt.claim.sub',user_a::text,true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',user_a,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  DELETE FROM public.sv_brands WHERE id=brand_a;
  IF NOT EXISTS(SELECT 1 FROM public.sv_connected_accounts WHERE id=account_a AND brand_id IS NULL) THEN
    RAISE EXCEPTION 'Deleting a brand lost or failed to ungroup its account'; END IF;
  RESET ROLE;
END $test$;
SELECT 'Signup profiles, two-user brand saves, rename, account storage, reconnect, duplicates, isolation and brand removal passed; all test records rolled back' AS verification;
ROLLBACK;
