-- QR-linked WhatsApp ("bridge") mode, alongside the official Cloud API mode
-- from 016. A bridge account's sends aren't made by the Edge Function — it
-- hands a paced job to the user's whatsapp-bridge service, which sends one
-- message at a time and reports each result back through whatsapp-webhook.
-- So a recipient can now sit in a new 'queued' state: accepted by the bridge,
-- not sent yet (a slow, ban-safe pace means that can be hours).

ALTER TABLE public.sv_whatsapp_recipients DROP CONSTRAINT sv_whatsapp_recipients_status_check;
ALTER TABLE public.sv_whatsapp_recipients ADD CONSTRAINT sv_whatsapp_recipients_status_check
  CHECK (status IN ('pending','queued','sent','delivered','read','failed'));

-- Bridge broadcasts have no template, and can target groups as well as contacts.
ALTER TABLE public.sv_whatsapp_broadcasts ALTER COLUMN template_name DROP NOT NULL;
ALTER TABLE public.sv_whatsapp_broadcasts ALTER COLUMN template_language DROP NOT NULL;
ALTER TABLE public.sv_whatsapp_broadcasts
  ADD COLUMN mode text NOT NULL DEFAULT 'cloud' CHECK (mode IN ('cloud','bridge')),
  ADD COLUMN bridge_pace text,
  ADD COLUMN group_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE VIEW public.sv_whatsapp_broadcast_stats WITH (security_invoker = true) AS
SELECT
  broadcast_id,
  count(*) FILTER (WHERE status = 'pending')   AS pending,
  count(*) FILTER (WHERE status = 'sent')      AS sent,
  count(*) FILTER (WHERE status = 'delivered') AS delivered,
  count(*) FILTER (WHERE status = 'read')      AS read,
  count(*) FILTER (WHERE status = 'failed')    AS failed,
  count(*) FILTER (WHERE status = 'queued')    AS queued
FROM public.sv_whatsapp_recipients
GROUP BY broadcast_id;
