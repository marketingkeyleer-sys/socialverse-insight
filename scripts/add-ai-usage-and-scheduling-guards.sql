-- Additive deployment only. Existing users, posts and data remain intact.
CREATE TABLE IF NOT EXISTS public.sv_ai_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hour_start timestamptz NOT NULL,
  requests integer NOT NULL DEFAULT 0 CHECK (requests >= 0),
  PRIMARY KEY (user_id, hour_start)
);
ALTER TABLE public.sv_ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sv_ai_usage FROM anon, authenticated;
GRANT ALL ON public.sv_ai_usage TO service_role;

CREATE OR REPLACE FUNCTION public.sv_reserve_ai_request(owner_id uuid, request_limit integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE used integer;
BEGIN
  IF request_limit < 1 OR request_limit > 10000 THEN RAISE EXCEPTION 'Invalid AI request limit'; END IF;
  INSERT INTO sv_ai_usage(user_id, hour_start, requests) VALUES (owner_id, date_trunc('hour', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC', 1)
  ON CONFLICT (user_id, hour_start) DO UPDATE SET requests = sv_ai_usage.requests + 1
    WHERE sv_ai_usage.requests < request_limit
  RETURNING requests INTO used;
  RETURN coalesce(used, -1);
END; $$;
REVOKE ALL ON FUNCTION public.sv_reserve_ai_request(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sv_reserve_ai_request(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.sv_check_scheduling_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE maximum integer; queued integer;
BEGIN
  IF NEW.status <> 'scheduled' THEN RETURN NEW; END IF;
  IF NEW.scheduled_at IS NULL OR NEW.scheduled_at <= now() THEN RAISE EXCEPTION 'Choose a scheduling time in the future'; END IF;
  IF coalesce(cardinality(NEW.connected_account_ids), 0) = 0 OR coalesce(cardinality(NEW.platforms), 0) = 0 THEN RAISE EXCEPTION 'Select at least one destination account'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'scheduled' AND OLD.user_id = NEW.user_id THEN RETURN NEW; END IF;
  END IF;
  SELECT max_scheduled_posts INTO maximum FROM sv_profiles WHERE id = NEW.user_id FOR UPDATE;
  IF maximum IS NULL THEN RAISE EXCEPTION 'Account plan could not be checked'; END IF;
  SELECT count(*) INTO queued FROM sv_posts WHERE user_id = NEW.user_id AND status = 'scheduled' AND id <> NEW.id;
  IF queued >= maximum THEN RAISE EXCEPTION 'Your active scheduled-post limit has been reached. Publish or cancel queued posts before scheduling more.'; END IF;
  RETURN NEW;
END; $$;
-- Creating a new trigger requires no migration runner or destructive reset.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sv_check_scheduling_limit_trigger' AND tgrelid = 'public.sv_posts'::regclass) THEN
    CREATE TRIGGER sv_check_scheduling_limit_trigger BEFORE INSERT OR UPDATE ON public.sv_posts
      FOR EACH ROW EXECUTE FUNCTION public.sv_check_scheduling_limit();
  END IF;
END; $$;
