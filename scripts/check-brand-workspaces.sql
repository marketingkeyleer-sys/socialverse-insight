-- Temporary test fixtures only. Every insert/update is rolled back.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $$
DECLARE owner_a uuid := gen_random_uuid(); owner_b uuid := gen_random_uuid();
  brand_a uuid; brand_other uuid; foreign_brand uuid; account_a uuid; account_other uuid; post_a uuid;
BEGIN
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
    (owner_a,'workspace-test-'||owner_a||'@example.invalid','{}'),
    (owner_b,'workspace-test-'||owner_b||'@example.invalid','{}');
  INSERT INTO sv_brands(user_id,name) VALUES(owner_b,'Temporary foreign company') RETURNING id INTO foreign_brand;
  PERFORM set_config('request.jwt.claim.sub',owner_a::text,true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',owner_a,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  INSERT INTO sv_brands(user_id,name) VALUES(owner_a,'Temporary company A') RETURNING id INTO brand_a;
  INSERT INTO sv_brands(user_id,name) VALUES(owner_a,'Temporary company B') RETURNING id INTO brand_other;
  INSERT INTO sv_connected_accounts(user_id,platform,platform_user_id,brand_id,followers_count)
    VALUES(owner_a,'facebook','test-'||gen_random_uuid(),brand_a,111) RETURNING id INTO account_a;
  INSERT INTO sv_connected_accounts(user_id,platform,platform_user_id,brand_id,followers_count)
    VALUES(owner_a,'facebook','test-'||gen_random_uuid(),brand_other,900) RETURNING id INTO account_other;
  INSERT INTO sv_posts(user_id,brand_id,content,platforms,connected_account_ids,platform_content)
    VALUES(owner_a,brand_a,'Working brief',ARRAY['facebook'],ARRAY[account_a],'{"facebook":{"content":"Specific Facebook caption","media_urls":[]}}') RETURNING id INTO post_a;
  IF NOT EXISTS(SELECT 1 FROM sv_posts WHERE id=post_a AND brand_id=brand_a AND platform_content->'facebook'->>'content'='Specific Facebook caption') THEN
    RAISE EXCEPTION 'Brand or variant failed to persist'; END IF;
  IF (SELECT sum(followers_count) FROM sv_connected_accounts WHERE brand_id=brand_a) <> 111 OR
     (SELECT sum(followers_count) FROM sv_connected_accounts WHERE brand_id=brand_other) <> 900 THEN
    RAISE EXCEPTION 'Brand audiences were mixed'; END IF;
  BEGIN
    UPDATE sv_posts SET connected_account_ids=ARRAY[account_other] WHERE id=post_a;
    RAISE EXCEPTION 'Cross-company destination accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE sv_posts SET brand_id=foreign_brand WHERE id=post_a;
    RAISE EXCEPTION 'Foreign company accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE sv_posts SET platform_content='[]' WHERE id=post_a;
    RAISE EXCEPTION 'Invalid variant accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RESET ROLE;
END $$;
SELECT 'Brand post persistence, independent followers, cross-company destination rejection and tenant isolation passed' AS verification;
ROLLBACK;
