-- Uses existing user IDs internally. No auth fixtures, credentials, HTTP
-- calls, messages, or posts are sent. All attempted writes are rolled back.
BEGIN;
SET LOCAL statement_timeout = '30s';
DO $test$
DECLARE owner_a uuid; owner_b uuid; account_a uuid; expected_a bigint; expected_b bigint; changed bigint;
BEGIN
  SELECT user_id, id INTO owner_a, account_a FROM public.sv_connected_accounts LIMIT 1;
  SELECT id INTO owner_b FROM public.sv_profiles WHERE id <> owner_a LIMIT 1;
  IF owner_a IS NULL OR owner_b IS NULL THEN RAISE EXCEPTION 'Two existing users and one connected account are required'; END IF;
  SELECT count(*) INTO expected_a FROM public.sv_connected_accounts WHERE user_id=owner_a;
  SELECT count(*) INTO expected_b FROM public.sv_connected_accounts WHERE user_id=owner_b;

  PERFORM set_config('request.jwt.claim.sub', owner_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.sv_connected_accounts) <> expected_a OR EXISTS(SELECT 1 FROM public.sv_connected_accounts WHERE user_id<>owner_a) THEN
    RAISE EXCEPTION 'User A isolation failed'; END IF;
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', owner_b::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_b, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.sv_connected_accounts) <> expected_b OR EXISTS(SELECT 1 FROM public.sv_connected_accounts WHERE user_id<>owner_b) THEN
    RAISE EXCEPTION 'User B isolation failed'; END IF;
  UPDATE public.sv_connected_accounts SET is_active=is_active WHERE id=account_a;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'User B can update A account'; END IF;
  BEGIN
    INSERT INTO public.sv_posts(user_id, content, platforms, connected_account_ids)
      VALUES (owner_b, 'Rolled-back isolation test', ARRAY['facebook'], ARRAY[account_a]);
    RAISE EXCEPTION 'Foreign publishing destination accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.sv_inbox_state(user_id, connected_account_id, conversation_id)
      VALUES (owner_b, account_a, 'rolled-back-isolation-test');
    RAISE EXCEPTION 'Foreign inbox reference accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.sv_profiles SET plan_tier='business' WHERE id=owner_b;
    RAISE EXCEPTION 'Self-service plan escalation accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM 1 FROM public.sv_oauth_pending;
    RAISE EXCEPTION 'Encrypted pending tokens accessible to authenticated users' USING ERRCODE='XX000';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
END $test$;
SELECT 'Two-user RLS, foreign account writes, publishing destinations, inbox references, plan privileges and token privacy passed' AS verification;
ROLLBACK;
