// Authenticated: sends a reply into one conversation. Meta enforces its own
// 24-hour "standard messaging window" since the customer's last message —
// a send outside that window fails with a Meta error surfaced as-is, not
// something this app can work around.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto.ts";
import { getRecipientId, sendMessage } from "../_shared/messaging.ts";

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

    const { accountId, conversationId, text } = await req.json();
    if (!text || !String(text).trim()) throw new Error("Message can't be empty");

    const { data: account, error: accountErr } = await supabase
      .from("sv_connected_accounts")
      .select("*")
      .eq("id", accountId)
      .single();
    if (accountErr || !account) throw new Error("Connected account not found");
    if (!account.page_access_token_ciphertext || !account.page_access_token_iv) {
      throw new Error("Disconnect and reconnect this account to enable messaging");
    }

    const token = await decryptToken(account.page_access_token_ciphertext, account.page_access_token_iv);
    const recipientId = await getRecipientId(conversationId, token, account.platform_user_id);
    const result = await sendMessage(account.platform_user_id, token, recipientId, String(text));

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
