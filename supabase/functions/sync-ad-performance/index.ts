// Authenticated: pulls spend/impressions/clicks/reach for every ad in one
// campaign. Manual trigger, not a cron — ad performance doesn't need to
// stay as fresh as organic post metrics, and this avoids spending API
// quota polling campaigns nobody's looking at.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto.ts";
import { fetchAdInsights } from "../_shared/ads.ts";

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

    const { campaignId } = await req.json();
    const { data: campaign, error: campaignErr } = await supabase
      .from("sv_ad_campaigns")
      .select("*, sv_ad_accounts(*, sv_connected_accounts(*))")
      .eq("id", campaignId)
      .single();
    if (campaignErr || !campaign) throw new Error("Campaign not found");

    const fbAccount = campaign.sv_ad_accounts?.sv_connected_accounts;
    if (!fbAccount?.access_token_ciphertext || !fbAccount?.token_iv) {
      throw new Error("Reconnect Facebook to enable Ads Manager");
    }
    const token = await decryptToken(fbAccount.access_token_ciphertext, fbAccount.token_iv);

    const { data: adSets } = await supabase.from("sv_ad_sets").select("id").eq("campaign_id", campaignId);
    const adSetIds = (adSets ?? []).map((a) => a.id);
    const { data: ads } = await supabase.from("sv_ads").select("*").in("ad_set_id", adSetIds).not("meta_ad_id", "is", null);

    let synced = 0;
    for (const ad of ads ?? []) {
      try {
        const insights = await fetchAdInsights(ad.meta_ad_id, token);
        if (insights) {
          await supabase
            .from("sv_ads")
            .update({
              spend_cents: insights.spendCents,
              impressions: insights.impressions,
              clicks: insights.clicks,
              reach: insights.reach,
              last_synced_at: new Date().toISOString(),
            })
            .eq("id", ad.id);
          synced++;
        }
      } catch {
        // One ad's insights failing (e.g. no delivery yet) shouldn't stop the rest.
        continue;
      }
    }

    return new Response(JSON.stringify({ ok: true, synced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
