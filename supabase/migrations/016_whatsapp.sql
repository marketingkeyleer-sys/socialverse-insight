-- WhatsApp Business (Cloud API) support.
--
-- Unlike the other platforms, WhatsApp isn't connected through an OAuth
-- redirect: the user supplies their own Phone Number ID, WABA ID and a
-- system-user access token, which the whatsapp Edge Function validates
-- against Meta and stores encrypted on a normal sv_connected_accounts row
-- (platform = 'whatsapp'). WABA id / quality rating live in `metadata`.

ALTER TABLE public.sv_connected_accounts DROP CONSTRAINT sv_connected_accounts_platform_check;
ALTER TABLE public.sv_connected_accounts ADD CONSTRAINT sv_connected_accounts_platform_check
  CHECK (platform IN ('facebook','instagram','youtube','linkedin','linkedin_page','whatsapp'));

ALTER TABLE public.sv_platform_posts DROP CONSTRAINT sv_platform_posts_platform_check;
ALTER TABLE public.sv_platform_posts ADD CONSTRAINT sv_platform_posts_platform_check
  CHECK (platform IN ('facebook','instagram','youtube','linkedin','linkedin_page','whatsapp'));

ALTER TABLE public.sv_connected_accounts
  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Per-post WhatsApp delivery settings (template + audience), read by
-- publish.ts when a post targets WhatsApp — including scheduled posts fired
-- by the cron, which have no browser session to ask the user again.
ALTER TABLE public.sv_posts
  ADD COLUMN whatsapp_options jsonb;

-- ============================================================
-- sv_whatsapp_contacts — the customer list broadcasts go to.
-- Only opted_in contacts are ever messaged. opted_in_at / opt_in_source
-- record how consent was obtained; an inbound STOP (see whatsapp-webhook)
-- flips opted_in back to false automatically.
-- ============================================================
CREATE TABLE public.sv_whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_account_id uuid NOT NULL REFERENCES public.sv_connected_accounts(id) ON DELETE CASCADE,
  phone text NOT NULL CHECK (phone ~ '^[0-9]{8,15}$'),
  name text,
  tags text[] NOT NULL DEFAULT '{}',
  opted_in boolean NOT NULL DEFAULT true,
  opted_in_at timestamptz,
  opt_in_source text,
  opted_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connected_account_id, phone)
);

CREATE INDEX sv_idx_wa_contacts_account ON public.sv_whatsapp_contacts(connected_account_id, opted_in);
CREATE INDEX sv_idx_wa_contacts_user ON public.sv_whatsapp_contacts(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sv_whatsapp_contacts TO authenticated;
GRANT ALL ON public.sv_whatsapp_contacts TO service_role;
ALTER TABLE public.sv_whatsapp_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sv_whatsapp_contacts_own" ON public.sv_whatsapp_contacts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- sv_whatsapp_broadcasts — one row per send of a post to an audience.
-- ============================================================
CREATE TABLE public.sv_whatsapp_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_account_id uuid NOT NULL REFERENCES public.sv_connected_accounts(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.sv_posts(id) ON DELETE SET NULL,
  template_name text NOT NULL,
  template_language text NOT NULL,
  header_format text,
  body_param_count integer NOT NULL DEFAULT 0,
  message_text text NOT NULL,
  media_url text,
  audience_tag text,
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','completed','partial','failed')),
  total integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sv_idx_wa_broadcasts_user ON public.sv_whatsapp_broadcasts(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sv_whatsapp_broadcasts TO authenticated;
GRANT ALL ON public.sv_whatsapp_broadcasts TO service_role;
ALTER TABLE public.sv_whatsapp_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sv_whatsapp_broadcasts_own" ON public.sv_whatsapp_broadcasts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- sv_whatsapp_recipients — per-contact delivery state. 'pending' rows are
-- what a broadcast that ran out of time (or was interrupted) resumes from;
-- delivered/read/failed come back from Meta through whatsapp-webhook, keyed
-- on wa_message_id.
-- ============================================================
CREATE TABLE public.sv_whatsapp_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.sv_whatsapp_broadcasts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.sv_whatsapp_contacts(id) ON DELETE SET NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','read','failed')),
  wa_message_id text,
  error_message text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sv_idx_wa_recipients_broadcast ON public.sv_whatsapp_recipients(broadcast_id, status);
CREATE INDEX sv_idx_wa_recipients_msgid ON public.sv_whatsapp_recipients(wa_message_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sv_whatsapp_recipients TO authenticated;
GRANT ALL ON public.sv_whatsapp_recipients TO service_role;
ALTER TABLE public.sv_whatsapp_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sv_whatsapp_recipients_own" ON public.sv_whatsapp_recipients
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Per-broadcast delivery counts for the Broadcasts tab, so it doesn't have to
-- pull every recipient row just to draw a progress summary. security_invoker
-- makes it run under the caller's RLS, so a user only ever sees their own.
CREATE VIEW public.sv_whatsapp_broadcast_stats WITH (security_invoker = true) AS
SELECT
  broadcast_id,
  count(*) FILTER (WHERE status = 'pending')   AS pending,
  count(*) FILTER (WHERE status = 'sent')      AS sent,
  count(*) FILTER (WHERE status = 'delivered') AS delivered,
  count(*) FILTER (WHERE status = 'read')      AS read,
  count(*) FILTER (WHERE status = 'failed')    AS failed
FROM public.sv_whatsapp_recipients
GROUP BY broadcast_id;

GRANT SELECT ON public.sv_whatsapp_broadcast_stats TO authenticated;
GRANT ALL ON public.sv_whatsapp_broadcast_stats TO service_role;
