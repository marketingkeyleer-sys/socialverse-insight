-- Reversible QA: every write is rolled back, no provider is called.
BEGIN;
DO $$ DECLARE owner uuid := 'f8d2218d-621f-4572-bf91-1c8de4df6ecd'; destination uuid; post_id uuid; blocked boolean := false; BEGIN
 SELECT id INTO destination FROM public.sv_connected_accounts WHERE user_id=owner AND is_active LIMIT 1;
 UPDATE public.sv_profiles SET max_scheduled_posts=1 WHERE id=owner;
 INSERT INTO public.sv_posts(user_id,content,status,scheduled_at,platforms,connected_account_ids) VALUES(owner,'Transactional QA only','scheduled',now()+interval '10 years',ARRAY['facebook'],ARRAY[destination]) RETURNING id INTO post_id;
 BEGIN
 INSERT INTO public.sv_posts(user_id,content,status,scheduled_at,platforms,connected_account_ids) VALUES(owner,'Must exceed quota','scheduled',now()+interval '10 years',ARRAY['facebook'],ARRAY[destination]);
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%limit has been reached%' THEN RAISE; END IF; blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Scheduling quota was not enforced'; END IF;
 UPDATE public.sv_posts SET content='Edit scheduled post keeps its slot' WHERE id=post_id;
 DELETE FROM public.sv_ai_usage WHERE user_id=owner AND hour_start=date_trunc('hour',now());
 IF public.sv_reserve_ai_request(owner,1) <> 1 OR public.sv_reserve_ai_request(owner,1) <> -1 THEN RAISE EXCEPTION 'AI quota was not enforced'; END IF;
END $$;
ROLLBACK;
SELECT 'Scheduling and AI quota checks passed; all QA writes rolled back' AS result;
