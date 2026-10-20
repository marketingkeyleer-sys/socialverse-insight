-- Direct additive setup. No migration runner, data rewrites or history changes.
BEGIN;
CREATE TEMP TABLE sv_brand_post_preserve ON COMMIT DROP AS
  SELECT id, md5((to_jsonb(p) - 'brand_id' - 'platform_content')::text) fingerprint FROM public.sv_posts p;
ALTER TABLE public.sv_posts ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.sv_brands(id) ON DELETE SET NULL;
ALTER TABLE public.sv_posts ADD COLUMN IF NOT EXISTS platform_content jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS sv_posts_brand_workspace ON public.sv_posts(user_id, brand_id, created_at DESC);
CREATE OR REPLACE FUNCTION public.sv_check_post_brand() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.brand_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM sv_brands WHERE id=NEW.brand_id AND user_id=NEW.user_id) THEN
      RAISE EXCEPTION 'Brand belongs to another user' USING ERRCODE='42501';
    END IF;
    IF EXISTS (SELECT 1 FROM sv_connected_accounts WHERE id=ANY(NEW.connected_account_ids) AND brand_id IS DISTINCT FROM NEW.brand_id) THEN
      RAISE EXCEPTION 'Choose destination accounts from this brand only' USING ERRCODE='23514';
    END IF;
  END IF;
  IF jsonb_typeof(NEW.platform_content) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Platform content must be an object' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='sv_post_brand_guard' AND tgrelid='public.sv_posts'::regclass) THEN
    CREATE TRIGGER sv_post_brand_guard BEFORE INSERT OR UPDATE OF brand_id, connected_account_ids, platform_content, user_id
      ON public.sv_posts FOR EACH ROW EXECUTE FUNCTION public.sv_check_post_brand();
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM sv_brand_post_preserve b LEFT JOIN public.sv_posts p USING(id)
    WHERE b.fingerprint IS DISTINCT FROM md5((to_jsonb(p) - 'brand_id' - 'platform_content')::text)) THEN
    RAISE EXCEPTION 'Existing posts changed';
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
SELECT 'Brand and platform content fields added; original posts preserved' AS verification;
COMMIT;
