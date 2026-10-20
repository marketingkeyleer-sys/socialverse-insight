// Authenticated: discovers the Meta Ad Accounts available to the connected
// Facebook account's user token, and upserts them so the ads UI has
// something to pick from. Read-only against Meta — nothing here spends
// anything.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto.ts";
import { listAdAccounts } from "../_shared/ads.ts";

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
      .eq("platform", "facebook")
      .single();
    if (accountErr || !account) throw new Error("Connected Facebook account not found");
    if (!account.access_token_ciphertext || !account.token_iv) {
      throw new Error("Reconnect Facebook to enable Ads Manager");
    }

    const token = await decryptToken(account.access_token_ciphertext, account.token_iv);
    const adAccounts = await listAdAccounts(token);

    if (adAccounts.length > 0) {
      const rows = adAccounts.map((a) => ({
        user_id: userData.user.id,
        connected_account_id: account.id,
        meta_ad_account_id: a.id,
        name: a.name,
        currency: a.currency,
        account_status: a.accountStatus,
      }));
      const { error: upsertErr } = await supabase
        .from("sv_ad_accounts")
        .upsert(rows, { onConflict: "user_id,meta_ad_account_id" });
      if (upsertErr) throw new Error(upsertErr.message);
    }

    return new Response(JSON.stringify({ ok: true, adAccounts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
