CREATE TABLE public.sv_inbox_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.sv_profiles(id) ON DELETE CASCADE,
  connected_account_id uuid NOT NULL REFERENCES public.sv_connected_accounts(id) ON DELETE CASCADE,
  conversation_id text NOT NULL,
  is_read boolean,
  read_updated_at timestamptz,
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 10000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connected_account_id, conversation_id)
);
ALTER TABLE public.sv_inbox_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY sv_inbox_state_own ON public.sv_inbox_state FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sv_inbox_state TO authenticated;
GRANT ALL ON public.sv_inbox_state TO service_role;
CREATE TRIGGER sv_inbox_account_owner BEFORE INSERT OR UPDATE ON public.sv_inbox_state
  FOR EACH ROW EXECUTE FUNCTION public.sv_check_reference_owner('connected_account_id', 'sv_connected_accounts');
CREATE TRIGGER sv_inbox_updated_at BEFORE UPDATE ON public.sv_inbox_state
  FOR EACH ROW EXECUTE FUNCTION public.sv_tg_set_updated_at();
