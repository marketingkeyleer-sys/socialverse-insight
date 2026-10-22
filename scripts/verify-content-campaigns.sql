-- Run after additive setup, before enabling cron. Every QA write rolls back.
BEGIN;
DO $$ DECLARE owner uuid:='f8d2218d-621f-4572-bf91-1c8de4df6ecd'; brand uuid; destination uuid; plan uuid; repeated uuid; slot sv_campaign_items; second_slot sv_campaign_items; saved uuid; blocked boolean:=false; request_key uuid:=gen_random_uuid(); BEGIN
 SELECT brand_id,id INTO brand,destination FROM sv_connected_accounts WHERE user_id=owner AND platform='linkedin_page' AND is_active AND brand_id IS NOT NULL LIMIT 1;
 IF destination IS NULL THEN RAISE EXCEPTION 'An owned LinkedIn Page is required for this transaction test'; END IF;
 plan:=sv_create_campaign(owner,brand,'Transactional QA','A company sharing practical professional education.',jsonb_build_object('timezone','Asia/Kolkata'),ARRAY[destination],false,false,1,ARRAY[now()+interval '2 days',now()+interval '3 days'],request_key);
 repeated:=sv_create_campaign(owner,brand,'Transactional QA','A company sharing practical professional education.',jsonb_build_object('timezone','Asia/Kolkata'),ARRAY[destination],false,false,1,ARRAY[now()+interval '2 days',now()+interval '3 days'],request_key);
 IF plan<>repeated OR (SELECT count(*) FROM sv_campaign_items WHERE campaign_id=plan)<>2 THEN RAISE EXCEPTION 'Idempotent creation failed'; END IF;
 UPDATE sv_content_campaigns SET status='active' WHERE id=plan;
 SELECT * INTO slot FROM sv_claim_campaign_item();
 IF slot.campaign_id IS DISTINCT FROM plan OR slot.lease_token IS NULL THEN RAISE EXCEPTION 'Queue claim failed'; END IF;
 IF EXISTS(SELECT 1 FROM sv_claim_campaign_item()) THEN RAISE EXCEPTION 'Daily reservation limit was not enforced'; END IF;
 UPDATE sv_campaign_items SET content='Reviewed caption #Education',generated_at=now() WHERE id=slot.id RETURNING * INTO slot;
 saved:=sv_finish_campaign_item(slot.id,slot.lease_token);
 IF NOT EXISTS(SELECT 1 FROM sv_posts WHERE id=saved AND status='draft' AND user_id=owner AND brand_id=brand AND campaign_item_id=slot.id) THEN RAISE EXCEPTION 'Review-first generation did not create an owned draft'; END IF;
 BEGIN PERFORM sv_finish_campaign_item(slot.id,slot.lease_token); EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%lease%' THEN RAISE; END IF; blocked:=true; END;
 IF NOT blocked OR (SELECT count(*) FROM sv_posts WHERE campaign_item_id=slot.id)<>1 THEN RAISE EXCEPTION 'Duplicate completion was not blocked'; END IF;
 UPDATE sv_content_campaigns SET daily_limit=2,auto_publish=true WHERE id=plan;
 SELECT * INTO second_slot FROM sv_claim_campaign_item();
 IF second_slot.id IS NULL OR second_slot.id=slot.id THEN RAISE EXCEPTION 'A second slot was not claimed independently'; END IF;
 UPDATE sv_campaign_items SET content='Automatic caption #Education',generated_at=now() WHERE id=second_slot.id;
 UPDATE sv_content_campaigns SET status='paused' WHERE id=plan;
 IF sv_finish_campaign_item(second_slot.id,second_slot.lease_token) IS NOT NULL THEN RAISE EXCEPTION 'Paused plan created a post'; END IF;
 UPDATE sv_content_campaigns SET status='active' WHERE id=plan;
 SELECT * INTO second_slot FROM sv_claim_campaign_item();
 IF second_slot.content IS NULL THEN RAISE EXCEPTION 'Saved caption was not retained after pause'; END IF;
 saved:=sv_finish_campaign_item(second_slot.id,second_slot.lease_token);
 IF NOT EXISTS(SELECT 1 FROM sv_posts WHERE id=saved AND status='scheduled' AND scheduled_at>now()) THEN RAISE EXCEPTION 'Automatic slot was not scheduled'; END IF;
 IF has_function_privilege('authenticated','public.sv_claim_campaign_item()','EXECUTE') THEN RAISE EXCEPTION 'A browser user can claim another user work'; END IF;
 IF has_table_privilege('authenticated','public.sv_content_campaigns','INSERT') THEN RAISE EXCEPTION 'Direct browser writes bypass validation'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.sv_content_campaigns) OR EXISTS(SELECT 1 FROM public.sv_campaign_items) THEN RAISE EXCEPTION 'Foreign planner rows were visible through RLS'; END IF;
END $$;
ROLLBACK;
SELECT 'Campaign transaction checks passed; all QA writes rolled back' AS result;
