// Public (Meta calls it directly, no Supabase session): the webhook for the
// WhatsApp Business Account. Does two things —
//   1. delivery receipts: moves sv_whatsapp_recipients through
//      sent -> delivered -> read, or to failed with Meta's reason
//   2. opt-outs: an inbound STOP / UNSUBSCRIBE flips that contact's
//      opted_in off, so they're never broadcast to again
// GET answers Meta's one-time subscription handshake; POST is authenticated
// by checking the X-Hub-Signature-256 HMAC against the Meta app secret.
import { createClient } from "npm:@supabase/supabase-js@2";
import { applyBridgeCallback, bridgeKey, isBridgeAccount } from "../_shared/whatsapp.ts";

const OPT_OUT = /^\s*(stop|stop all|unsubscribe|opt[- ]?out|cancel)\s*[.!]?\s*$/i;

async function validSignature(rawBody: string, header: string | null): Promise<boolean> {
  const secret = Deno.env.get("META_CLIENT_SECRET");
  if (!secret) return false;
  return await validBridgeSignature(rawBody, header, secret);
}

// HMAC-SHA256 of the raw body, compared in constant time. Meta signs with the
// app secret and a bridge signs with its API key; both send "sha256=<hex>".
async function validBridgeSignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const expected = Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("");
  const given = header.slice("sha256=".length);
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    if (
      verifyToken &&
      url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") === verifyToken
    ) {
      return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Callbacks from a user's own whatsapp-bridge: per-message send results and
  // STOP replies. Each is signed with that bridge's API key, which only this
  // account's owner and this backend know, so the key found for the claimed
  // account is what the signature must verify against.
  const bridgeSignature = req.headers.get("x-bridge-signature");
  if (bridgeSignature) {
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const { data: account } = await admin
      .from("sv_connected_accounts")
      .select("*")
      .eq("id", String(payload?.accountId ?? ""))
      .eq("platform", "whatsapp")
      .maybeSingle();
    if (!account || !isBridgeAccount(account)) {
      return new Response("Unknown account", { status: 404 });
    }
    if (!(await validBridgeSignature(raw, bridgeSignature, bridgeKey()))) {
      return new Response("Invalid signature", { status: 401 });
    }
    try {
      await applyBridgeCallback(admin, account, payload);
    } catch (error) {
      // 5xx makes the bridge keep these results and retry, rather than lose them.
      console.error("whatsapp-webhook bridge callback error", error);
      return new Response("Processing error", { status: 500 });
    }
    return new Response("ok", { status: 200 });
  }

  if (!(await validSignature(raw, req.headers.get("x-hub-signature-256")))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const now = new Date().toISOString();

  try {
    const payload = JSON.parse(raw);
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};

        for (const s of value.statuses ?? []) {
          if (!s.id) continue;
          if (s.status === "delivered") {
            await admin
              .from("sv_whatsapp_recipients")
              .update({ status: "delivered", updated_at: now })
              .eq("wa_message_id", s.id)
              .eq("status", "sent");
          } else if (s.status === "read") {
            await admin
              .from("sv_whatsapp_recipients")
              .update({ status: "read", updated_at: now })
              .eq("wa_message_id", s.id)
              .in("status", ["sent", "delivered"]);
          } else if (s.status === "failed") {
            await admin
              .from("sv_whatsapp_recipients")
              .update({
                status: "failed",
                error_message: s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? "Delivery failed",
                updated_at: now,
              })
              .eq("wa_message_id", s.id);
          }
        }

        for (const m of value.messages ?? []) {
          const text: string | undefined = m.text?.body ?? m.button?.text;
          if (!m.from || !text || !OPT_OUT.test(text)) continue;
          const phoneNumberId = value.metadata?.phone_number_id;
          if (!phoneNumberId) continue;

          const { data: accounts } = await admin
            .from("sv_connected_accounts")
            .select("id")
            .eq("platform", "whatsapp")
            .eq("platform_user_id", phoneNumberId);
          const accountIds = (accounts ?? []).map((a) => a.id);
          if (accountIds.length === 0) continue;

          await admin
            .from("sv_whatsapp_contacts")
            .update({ opted_in: false, opted_out_at: now })
            .eq("phone", String(m.from))
            .in("connected_account_id", accountIds);
        }
      }
    }
  } catch (error) {
    // Always 200 for a validly-signed payload we couldn't fully process —
    // Meta retries non-2xx for days, which would just replay the same bad data.
    console.error("whatsapp-webhook processing error", error);
  }

  return new Response("ok", { status: 200 });
});
