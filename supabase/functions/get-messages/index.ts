// Authenticated: fetches the message thread for one conversation.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto.ts";
import { fetchMessages } from "../_shared/messaging.ts";

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

    const { accountId, conversationId } = await req.json();
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
    const messages = await fetchMessages(conversationId, token);

    return new Response(JSON.stringify({ ok: true, messages, ownerId: account.platform_user_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
