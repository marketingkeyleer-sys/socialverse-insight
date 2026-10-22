-- Additive only. No migration runner, reset or existing-data deletion.
CREATE TABLE IF NOT EXISTS public.sv_content_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.sv_profiles(id) ON DELETE CASCADE,
 brand_id uuid NOT NULL REFERENCES public.sv_brands(id) ON DELETE CASCADE, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
 brief text NOT NULL CHECK(length(brief) BETWEEN 30 AND 4000), schedule jsonb NOT NULL,
 account_ids uuid[] NOT NULL, with_images boolean NOT NULL DEFAULT false, auto_publish boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'paused' CHECK(status IN ('paused','active','completed')),
 daily_limit integer NOT NULL DEFAULT 6 CHECK(daily_limit BETWEEN 1 AND 20), last_error text,
 request_key uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,request_key)
);
CREATE TABLE IF NOT EXISTS public.sv_campaign_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.sv_content_campaigns(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.sv_profiles(id) ON DELETE CASCADE, account_id uuid NOT NULL REFERENCES public.sv_connected_accounts(id),
 publish_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','generating','ready','review','scheduled','failed')),
 content text, media_urls text[] NOT NULL DEFAULT '{}', generated_at timestamptz, error_message text,
 lease_token uuid, claimed_at timestamptz, generation_reserved_at timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(), post_id uuid REFERENCES public.sv_posts(id) ON DELETE SET NULL,
 UNIQUE(campaign_id,account_id,publish_at)
);
CREATE INDEX IF NOT EXISTS sv_campaign_items_pending ON public.sv_campaign_items(status,publish_at);
ALTER TABLE public.sv_posts ADD COLUMN IF NOT EXISTS campaign_item_id uuid REFERENCES public.sv_campaign_items(id);
CREATE UNIQUE INDEX IF NOT EXISTS sv_posts_campaign_item_unique ON public.sv_posts(campaign_item_id) WHERE campaign_item_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.sv_validate_campaign_post_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.campaign_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sv_campaign_items i JOIN sv_content_campaigns c ON c.id=i.campaign_id WHERE i.id=NEW.campaign_item_id AND i.user_id=NEW.user_id AND c.brand_id=NEW.brand_id) THEN RAISE EXCEPTION 'Campaign slot must belong to the post owner and brand'; END IF;
 RETURN NEW;
END $$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='sv_campaign_post_owner' AND tgrelid='public.sv_posts'::regclass) THEN
 CREATE TRIGGER sv_campaign_post_owner BEFORE INSERT OR UPDATE OF campaign_item_id,user_id,brand_id ON public.sv_posts FOR EACH ROW EXECUTE FUNCTION public.sv_validate_campaign_post_owner(); END IF;
END $$;
ALTER TABLE public.sv_content_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sv_campaign_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sv_content_campaigns, public.sv_campaign_items FROM anon,authenticated;
GRANT SELECT ON public.sv_content_campaigns, public.sv_campaign_items TO authenticated;
GRANT ALL ON public.sv_content_campaigns, public.sv_campaign_items TO service_role;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sv_content_campaigns' AND policyname='campaign_owner_read') THEN
 CREATE POLICY campaign_owner_read ON public.sv_content_campaigns FOR SELECT TO authenticated USING(user_id=auth.uid()); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sv_campaign_items' AND policyname='campaign_item_owner_read') THEN
 CREATE POLICY campaign_item_owner_read ON public.sv_campaign_items FOR SELECT TO authenticated USING(user_id=auth.uid()); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sv_create_campaign(owner_id uuid,brand uuid,campaign_name text,company_brief text,config jsonb,destinations uuid[],images boolean,automatic boolean,daily_max integer,slots timestamptz[],request_key_in uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE plan uuid; existing sv_content_campaigns; BEGIN
 PERFORM 1 FROM sv_profiles WHERE id=owner_id FOR UPDATE;
 SELECT * INTO existing FROM sv_content_campaigns WHERE user_id=owner_id AND request_key=request_key_in;
 IF existing.id IS NOT NULL THEN
 IF existing.brand_id IS DISTINCT FROM brand OR existing.name IS DISTINCT FROM campaign_name OR existing.brief IS DISTINCT FROM company_brief OR existing.schedule IS DISTINCT FROM config OR existing.account_ids IS DISTINCT FROM destinations OR existing.with_images IS DISTINCT FROM images OR existing.auto_publish IS DISTINCT FROM automatic OR existing.daily_limit IS DISTINCT FROM daily_max THEN RAISE EXCEPTION 'A previous save already used this request. Refresh and review the saved plan before creating another.'; END IF;
 RETURN existing.id; END IF;
 IF NOT EXISTS(SELECT 1 FROM sv_brands WHERE id=brand AND user_id=owner_id) THEN RAISE EXCEPTION 'Choose an owned brand'; END IF;
 IF cardinality(destinations)<1 OR cardinality(destinations)>50 OR cardinality(slots)<1 OR cardinality(slots)*cardinality(destinations)>2500 THEN RAISE EXCEPTION 'Invalid campaign size (maximum 2500 posts)'; END IF;
 IF (SELECT count(*) FROM sv_content_campaigns WHERE user_id=owner_id AND status<>'completed')>=10 THEN RAISE EXCEPTION 'Complete or remove existing plans before creating more (10 plans maximum)'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(destinations) AS dest(value) WHERE NOT EXISTS(SELECT 1 FROM sv_connected_accounts a WHERE a.id=dest.value AND a.user_id=owner_id AND a.brand_id=brand AND a.is_active AND a.platform IN ('facebook','instagram','linkedin','linkedin_page'))) THEN RAISE EXCEPTION 'Destinations must be active accounts in this brand'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(slots) AS slot(value) WHERE slot.value<=now()+interval '1 hour' OR slot.value>now()+interval '2 years') THEN RAISE EXCEPTION 'Invalid campaign time'; END IF;
 INSERT INTO sv_content_campaigns(user_id,brand_id,name,brief,schedule,account_ids,with_images,auto_publish,daily_limit,request_key)
 VALUES(owner_id,brand,campaign_name,company_brief,config,destinations,images,automatic,daily_max,request_key_in) RETURNING id INTO plan;
 INSERT INTO sv_campaign_items(campaign_id,user_id,account_id,publish_at)
 SELECT plan,owner_id,a,t FROM unnest(destinations) a CROSS JOIN unnest(slots) t;
 RETURN plan;
END $$;

CREATE OR REPLACE FUNCTION public.sv_claim_campaign_item()
RETURNS SETOF public.sv_campaign_items LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE chosen uuid; chosen_plan uuid; budget_day timestamptz := date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; BEGIN
 -- Expired work is held for explicit retry: never blindly repeat a paid image request.
 UPDATE sv_campaign_items SET status='failed',error_message='Generation was interrupted. Review before retrying.',lease_token=NULL WHERE status='generating' AND claimed_at<now()-interval '10 minutes';
 UPDATE sv_campaign_items i SET status='failed',error_message='Publishing slot passed. Edit or create a new slot.' FROM sv_content_campaigns c WHERE c.id=i.campaign_id AND c.status='active' AND i.status IN ('pending','ready') AND i.publish_at<=now()+interval '1 hour';
 SELECT c.id INTO chosen_plan FROM sv_content_campaigns c WHERE c.status='active'
 AND EXISTS(SELECT 1 FROM sv_campaign_items i WHERE i.campaign_id=c.id AND i.status IN ('pending','ready') AND i.next_attempt_at<=now() AND i.publish_at>now()+interval '1 hour' AND i.publish_at<=now()+interval '14 days'
 AND (i.content IS NOT NULL OR (SELECT count(*) FROM sv_campaign_items today WHERE today.campaign_id=c.id AND today.generation_reserved_at>=budget_day)<c.daily_limit))
 ORDER BY (SELECT min(i.publish_at) FROM sv_campaign_items i WHERE i.campaign_id=c.id AND i.status IN ('pending','ready')),c.id
 LIMIT 1 FOR UPDATE OF c SKIP LOCKED;
 IF chosen_plan IS NULL THEN RETURN; END IF;
 -- The second statement sees the latest committed reservations after taking
 -- the plan lock; parallel workers cannot over-reserve its daily budget.
 SELECT i.id INTO chosen FROM sv_campaign_items i WHERE i.campaign_id=chosen_plan AND i.status IN ('pending','ready') AND i.next_attempt_at<=now()
 AND i.publish_at>now()+interval '1 hour' AND i.publish_at<=now()+interval '14 days'
 AND (i.content IS NOT NULL OR (SELECT count(*) FROM sv_campaign_items today WHERE today.campaign_id=chosen_plan AND today.generation_reserved_at>=budget_day)<(SELECT daily_limit FROM sv_content_campaigns WHERE id=chosen_plan))
 ORDER BY i.publish_at,i.id LIMIT 1 FOR UPDATE OF i SKIP LOCKED;
 IF chosen IS NULL THEN RETURN; END IF;
 RETURN QUERY UPDATE sv_campaign_items SET status='generating',claimed_at=now(),generation_reserved_at=CASE WHEN content IS NULL THEN now() ELSE generation_reserved_at END,lease_token=gen_random_uuid() WHERE id=chosen RETURNING *;
END $$;

CREATE OR REPLACE FUNCTION public.sv_finish_campaign_item(item_id uuid,lease uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item sv_campaign_items; plan sv_content_campaigns; destination sv_connected_accounts; saved uuid; BEGIN
 SELECT * INTO item FROM sv_campaign_items WHERE id=item_id FOR UPDATE;
 IF item.id IS NULL OR item.status<>'generating' OR item.lease_token IS DISTINCT FROM lease THEN RAISE EXCEPTION 'Generation lease is no longer valid'; END IF;
 SELECT * INTO plan FROM sv_content_campaigns WHERE id=item.campaign_id FOR UPDATE;
 IF plan.status<>'active' THEN UPDATE sv_campaign_items SET status='ready',lease_token=NULL WHERE id=item.id; RETURN NULL; END IF;
 SELECT * INTO destination FROM sv_connected_accounts WHERE id=item.account_id AND user_id=item.user_id AND brand_id=plan.brand_id AND is_active;
 IF destination.id IS NULL THEN RAISE EXCEPTION 'Destination is no longer active in this brand'; END IF;
 IF item.publish_at<=now()+interval '1 minute' THEN RAISE EXCEPTION 'Publishing time has passed'; END IF;
 IF coalesce(length(trim(item.content)),0)=0 THEN RAISE EXCEPTION 'Generated caption is empty'; END IF;
 INSERT INTO sv_posts(user_id,brand_id,title,content,media_urls,platforms,connected_account_ids,status,scheduled_at,tags,platform_content,campaign_item_id)
 VALUES(item.user_id,plan.brand_id,plan.name,item.content,item.media_urls,ARRAY[destination.platform],ARRAY[item.account_id],CASE WHEN plan.auto_publish THEN 'scheduled' ELSE 'draft' END,item.publish_at,ARRAY['campaign'],jsonb_build_object(destination.platform,jsonb_build_object('content',item.content,'media_urls',item.media_urls)),item.id) RETURNING id INTO saved;
 UPDATE sv_campaign_items SET post_id=saved,status=CASE WHEN plan.auto_publish THEN 'scheduled' ELSE 'review' END,lease_token=NULL,error_message=NULL WHERE id=item.id;
 RETURN saved;
END $$;
REVOKE ALL ON FUNCTION public.sv_create_campaign(uuid,uuid,text,text,jsonb,uuid[],boolean,boolean,integer,timestamptz[],uuid),public.sv_claim_campaign_item(),public.sv_finish_campaign_item(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sv_create_campaign(uuid,uuid,text,text,jsonb,uuid[],boolean,boolean,integer,timestamptz[],uuid),public.sv_claim_campaign_item(),public.sv_finish_campaign_item(uuid,uuid) TO service_role;
