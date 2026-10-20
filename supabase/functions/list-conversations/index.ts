// Authenticated: lists a connected Facebook/Instagram account's real DM
// conversations. Fetched live on every call, not cached — inboxes change
// too often for a sync-interval model to feel right, and this avoids a new
// table + cron just for messaging.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto.ts";
import { fetchConversations } from "../_shared/messaging.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { accountId } = await req.json();
    const { data: account, error: accountErr } = await supabase
      .from("sv_connected_accounts")
      .select("*")
      .eq("id", accountId)
      .single();
    if (accountErr || !account) throw new Error("Connected account not found");
    if (account.platform !== "facebook" && account.platform !== "instagram") {
      throw new Error("Messaging is only available for Facebook and Instagram right now");
    }
    if (!account.page_access_token_ciphertext || !account.page_access_token_iv) {
      throw new Error("Disconnect and reconnect this account to enable messaging");
    }

    const token = await decryptToken(account.page_access_token_ciphertext, account.page_access_token_iv);
    const conversations = await fetchConversations(account.platform_user_id, token, account.platform);

    return new Response(JSON.stringify({ ok: true, conversations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
