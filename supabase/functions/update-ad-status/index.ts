// Authenticated: the one place a campaign/ad set/ad actually starts (or
// stops) spending. Requires an explicit level + id + desired status — never
// inferred, never bundled into a create call.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto.ts";
import { setStatus } from "../_shared/ads.ts";

type Level = "campaign" | "adSet" | "ad";

const TABLE_BY_LEVEL: Record<Level, string> = {
  campaign: "sv_ad_campaigns",
  adSet: "sv_ad_sets",
  ad: "sv_ads",
};
const META_ID_COLUMN: Record<Level, string> = {
  campaign: "meta_campaign_id",
  adSet: "meta_adset_id",
  ad: "meta_ad_id",
};

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

    const { level, id, status } = (await req.json()) as { level: Level; id: string; status: "active" | "paused" };
    const table = TABLE_BY_LEVEL[level];
    if (!table) throw new Error(`Unknown level: ${level}`);

    const { data: row, error: rowErr } = await supabase.from(table).select("*").eq("id", id).single();
    if (rowErr || !row) throw new Error("Not found");
    const metaId = row[META_ID_COLUMN[level]];
    if (!metaId) throw new Error("This object hasn't been created on Meta yet");

    // Walk up to the Facebook connection regardless of level, to decrypt
    // the token that actually has ads_management.
    let campaignId = level === "campaign" ? row.id : level === "adSet" ? row.campaign_id : null;
    if (level === "ad") {
      const { data: adSet } = await supabase.from("sv_ad_sets").select("campaign_id").eq("id", row.ad_set_id).single();
      campaignId = adSet?.campaign_id;
    }
    const { data: campaign } = await supabase
      .from("sv_ad_campaigns")
      .select("ad_account_id")
      .eq("id", campaignId)
      .single();
    const { data: adAccount } = await supabase
      .from("sv_ad_accounts")
      .select("*, sv_connected_accounts(*)")
      .eq("id", campaign?.ad_account_id)
      .single();
    const fbAccount = adAccount?.sv_connected_accounts;
    if (!fbAccount?.access_token_ciphertext || !fbAccount?.token_iv) {
      throw new Error("Reconnect Facebook to enable Ads Manager");
    }
    const token = await decryptToken(fbAccount.access_token_ciphertext, fbAccount.token_iv);

    await setStatus(metaId, token, status === "active" ? "ACTIVE" : "PAUSED");
    await supabase.from(table).update({ status }).eq("id", id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
