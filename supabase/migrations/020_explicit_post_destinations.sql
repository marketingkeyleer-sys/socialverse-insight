ALTER TABLE public.sv_posts ADD COLUMN connected_account_ids uuid[];
CREATE FUNCTION public.sv_check_post_destinations() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.connected_account_ids IS NOT NULL AND EXISTS (
    SELECT 1 FROM unnest(NEW.connected_account_ids) selected_id
    WHERE NOT EXISTS (SELECT 1 FROM sv_connected_accounts a WHERE a.id = selected_id AND a.user_id = NEW.user_id)
  ) THEN RAISE EXCEPTION 'Destination account belongs to another user or was disconnected' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sv_post_destination_owner BEFORE INSERT OR UPDATE OF connected_account_ids, user_id ON sv_posts
  FOR EACH ROW EXECUTE FUNCTION sv_check_post_destinations();
