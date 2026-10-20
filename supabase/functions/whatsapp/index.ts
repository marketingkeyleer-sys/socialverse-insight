// Authenticated: everything the WhatsApp tab needs that can't run in the
// browser because it touches a secret (Meta access token or bridge API key) —
//   connect          mode "bridge": create a QR-linked WhatsApp account on the shared
//                    bridge (no credentials from the user)
//                    mode "cloud": validate Phone Number ID + WABA ID + token
//   broadcast        send a one-off message to contacts and/or groups
//   templates        Cloud API: the WABA's APPROVED message templates
//   bridge-status    QR bridge: connection state + the QR code to scan
//   bridge-session   QR bridge: start / restart / unlink the session
//   bridge-groups    QR bridge: the groups on the linked number
//   resume           send what's left of a broadcast / retry its failures
//   cancel           stop a broadcast that hasn't finished sending
// Runs on the caller's own RLS-scoped client.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { decryptToken, encryptToken } from "../_shared/crypto.ts";
import {
  assertPhoneBelongsToWaba,
  bridgeRequest,
  createAndRunBroadcast,
  sessionPath,
  cancelBridgeBroadcast,
  getPhoneNumberInfo,
  isBridgeAccount,
  listApprovedTemplates,
  resumeBroadcast,
  settleBroadcast,
} from "../_shared/whatsapp.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Not authenticated" }, 401);
    const userId = userData.user.id;

    const body = await req.json();

    async function loadAccount(accountId: string) {
      const { data } = await supabase
        .from("sv_connected_accounts")
        .select("*")
        .eq("id", accountId)
        .eq("platform", "whatsapp")
        .single();
      if (!data) throw new Error("WhatsApp account not found");
      return data;
    }

    async function assertRoomForAnotherAccount() {
      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from("sv_profiles").select("max_connected_accounts").eq("id", userId).single(),
        supabase.from("sv_connected_accounts").select("id", { count: "exact", head: true }),
      ]);
      if (profile && (count ?? 0) >= profile.max_connected_accounts) {
        throw new Error(`You've reached your plan's limit of ${profile.max_connected_accounts} connected accounts`);
      }
    }

    if (body.action === "connect" && body.mode === "bridge") {
      // Fail early, and clearly, if the operator hasn't set the service up.
      await bridgeRequest("/health");
      await assertRoomForAnotherAccount();
      const id = crypto.randomUUID();
      const { data: account, error } = await supabase
        .from("sv_connected_accounts")
        .insert({
          id,
          user_id: userId,
          platform: "whatsapp",
          platform_user_id: `qr:${id}`,
          platform_username: null,
          platform_display_name: "WhatsApp (linking…)",
          scopes: [],
          is_active: true,
          metadata: { mode: "bridge" },
          brand_id: body.brandId ?? null,
          last_synced_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) {
        throw new Error(
          error.code === "23505" ? "This brand already has a WhatsApp number. Disconnect it first, or use another brand." : error.message,
        );
      }
      // Start the session so a QR is ready by the time the page opens.
      await bridgeRequest(sessionPath(account, "start"), { method: "POST", body: {} }).catch(() => {});
      return json({ ok: true, accountId: account.id, state: "starting" });
    }

    if (body.action === "connect") {
      const phoneNumberId = String(body.phoneNumberId ?? "").trim();
      const wabaId = String(body.wabaId ?? "").trim();
      const accessToken = String(body.accessToken ?? "").trim();
      if (!/^\d+$/.test(phoneNumberId) || !/^\d+$/.test(wabaId) || !accessToken) {
        throw new Error("Phone Number ID and WhatsApp Business Account ID must be numbers, and an access token is required");
      }

      // Reconnecting an existing number never counts against the plan limit.
      const { data: existing } = await supabase
        .from("sv_connected_accounts")
        .select("id")
        .eq("platform", "whatsapp")
        .eq("platform_user_id", phoneNumberId)
        .maybeSingle();
      if (!existing) await assertRoomForAnotherAccount();

      // Both calls double as token validation: a wrong/expired token or a
      // number from a different WABA fails here, not on the first broadcast.
      const info = await getPhoneNumberInfo(phoneNumberId, accessToken);
      await assertPhoneBelongsToWaba(wabaId, phoneNumberId, accessToken);

      const enc = await encryptToken(accessToken);
      const { data: account, error } = await supabase
        .from("sv_connected_accounts")
        .upsert(
          {
            user_id: userId,
            platform: "whatsapp",
            platform_user_id: phoneNumberId,
            platform_username: info.display_phone_number ?? null,
            platform_display_name: info.verified_name ?? info.display_phone_number ?? "WhatsApp",
            access_token_ciphertext: enc.ciphertext,
            token_iv: enc.iv,
            scopes: ["whatsapp_business_management", "whatsapp_business_messaging"],
            is_active: true,
            metadata: { mode: "cloud", waba_id: wabaId, quality_rating: info.quality_rating ?? null },
            brand_id: body.brandId ?? null,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "user_id,platform,platform_user_id" },
        )
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      return json({ ok: true, accountId: account.id, displayName: info.verified_name, phone: info.display_phone_number });
    }

    if (body.action === "templates") {
      const account = await loadAccount(body.accountId);
      if (isBridgeAccount(account)) throw new Error("Templates only apply to the official WhatsApp Cloud API");
      if (!account.access_token_ciphertext) throw new Error("WhatsApp account not found");
      const wabaId = account.metadata?.waba_id;
      if (!wabaId) throw new Error("Reconnect WhatsApp — its Business Account ID is missing");
      const token = await decryptToken(account.access_token_ciphertext, account.token_iv);
      return json({ templates: await listApprovedTemplates(wabaId, token) });
    }

    if (body.action === "bridge-status") {
      const account = await loadAccount(body.accountId);
      if (!isBridgeAccount(account)) throw new Error("This WhatsApp account isn't a QR-linked one");
      const status = await bridgeRequest(sessionPath(account, "status"));
      // Once the QR is scanned, adopt the real name and number.
      if (status.state === "ready" && status.account?.phone) {
        const phone = `+${status.account.phone}`;
        const name = status.account.name || "WhatsApp";
        if (account.platform_username !== phone || account.platform_display_name !== name) {
          await supabase
            .from("sv_connected_accounts")
            .update({ platform_username: phone, platform_display_name: name, is_active: true })
            .eq("id", account.id);
        }
      }
      return json({ state: status.state, qr: status.qr ?? null, account: status.account ?? null, error: status.error || null });
    }

    if (body.action === "bridge-session") {
      const account = await loadAccount(body.accountId);
      if (!isBridgeAccount(account)) throw new Error("This WhatsApp account isn't a QR-linked one");
      const op = ({ start: "start", restart: "restart", logout: "logout" } as Record<string, string>)[String(body.op)];
      if (!op) throw new Error("Unknown session action");
      const status = await bridgeRequest(sessionPath(account, op), { method: "POST", body: {} });
      return json({ state: status.state, qr: status.qr ?? null, account: status.account ?? null, error: status.error || null });
    }

    if (body.action === "bridge-pairing-code") {
      const account = await loadAccount(body.accountId);
      if (!isBridgeAccount(account)) throw new Error("This WhatsApp account isn't a QR-linked one");
      const phone = String(body.phone ?? "").replace(/[^0-9]/g, "");
      if (!/^[1-9][0-9]{7,14}$/.test(phone)) throw new Error("Enter the phone number with country code, like 919876543210");
      const { code } = await bridgeRequest(sessionPath(account, "pairing-code"), { method: "POST", body: { phone } });
      return json({ code });
    }

    if (body.action === "bridge-groups") {
      const account = await loadAccount(body.accountId);
      if (!isBridgeAccount(account)) throw new Error("Groups need a QR-linked WhatsApp account");
      return json({ groups: (await bridgeRequest(sessionPath(account, "groups"))).groups ?? [] });
    }

    // A one-off message to a list and/or groups, without writing a post.
    if (body.action === "broadcast") {
      const account = await loadAccount(body.accountId);
      const text = String(body.text ?? "").trim();
      if (!text) throw new Error("Write the message to send");
      const mediaUrl = body.mediaUrl ? String(body.mediaUrl) : null;
      const { broadcastId, counts } = await createAndRunBroadcast(supabase, userId, account, {
        text,
        mediaUrl,
        postId: null,
        options: body.options ?? {},
      });
      return json({ ok: true, broadcastId, counts });
    }

    if (body.action === "resume" || body.action === "cancel") {
      const { data: broadcast } = await supabase
        .from("sv_whatsapp_broadcasts")
        .select("*")
        .eq("id", body.broadcastId)
        .single();
      if (!broadcast) throw new Error("Broadcast not found");
      const account = await loadAccount(broadcast.connected_account_id);

      if (body.action === "cancel") {
        if (broadcast.mode === "bridge") return json({ ok: true, counts: await cancelBridgeBroadcast(supabase, broadcast, account) });
        await supabase
          .from("sv_whatsapp_recipients")
          .update({ status: "failed", error_message: "Cancelled before sending", updated_at: new Date().toISOString() })
          .eq("broadcast_id", broadcast.id)
          .eq("status", "pending");
        return json({ ok: true, counts: await settleBroadcast(supabase, broadcast.id) });
      }

      return json({ ok: true, counts: await resumeBroadcast(supabase, broadcast, account, Boolean(body.retryFailed)) });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
