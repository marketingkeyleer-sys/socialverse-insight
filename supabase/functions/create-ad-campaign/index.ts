// Authenticated: creates a full campaign -> ad set -> creative -> ad chain
// on Meta's Marketing API, then mirrors each real id back into our own
// tables. Every object is created PAUSED — this function never activates
// anything, so it can't spend money on its own.
//
// Best-effort by design: if a later step fails (e.g. ad creative rejected),
// whatever succeeded before it is still saved with its real Meta id and a
// clear status, instead of the whole attempt being silently lost.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { decryptToken } from "../_shared/crypto.ts";
import {
  createAd,
  createAdSet,
  createCampaign,
  createCreativeFromPost,
  createCreativeFromScratch,
  type Targeting,
} from "../_shared/ads.ts";

interface RequestBody {
  adAccountRowId: string;
  campaign: { name: string; objective: string };
  adSet: {
    name: string;
    dailyBudgetCents: number;
    startTime: string;
    endTime: string | null;
    targeting: Targeting;
  };
  ad: {
    name: string;
    postId?: string;
    headline?: string;
    body?: string;
    mediaUrl?: string;
    destinationUrl?: string;
    callToAction?: string;
  };
}

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

    const body = (await req.json()) as RequestBody;
    if (!body.ad.postId && !(body.ad.headline && body.ad.body && body.ad.mediaUrl && body.ad.destinationUrl)) {
      throw new Error("Either boost an existing post, or provide headline/body/media/destination for new creative");
    }

    const { data: adAccount, error: adAccountErr } = await supabase
      .from("sv_ad_accounts")
      .select("*, sv_connected_accounts(*)")
      .eq("id", body.adAccountRowId)
      .single();
    if (adAccountErr || !adAccount) throw new Error("Ad account not found");

    const fbAccount = adAccount.sv_connected_accounts;
    if (!fbAccount?.access_token_ciphertext || !fbAccount?.token_iv) {
      throw new Error("Reconnect Facebook to enable Ads Manager");
    }
    const token = await decryptToken(fbAccount.access_token_ciphertext, fbAccount.token_iv);
    const pageId = fbAccount.platform_user_id as string;
    const metaAdAccountId = adAccount.meta_ad_account_id as string;

    // 1. Campaign
    const { data: campaignRow, error: campaignInsertErr } = await supabase
      .from("sv_ad_campaigns")
      .insert({
        user_id: userData.user.id,
        ad_account_id: adAccount.id,
        name: body.campaign.name,
        objective: body.campaign.objective,
        status: "draft",
      })
      .select()
      .single();
    if (campaignInsertErr) throw new Error(campaignInsertErr.message);

    let metaCampaignId: string;
    try {
      metaCampaignId = await createCampaign(metaAdAccountId, token, body.campaign.name, body.campaign.objective);
      await supabase.from("sv_ad_campaigns").update({ meta_campaign_id: metaCampaignId, status: "paused" }).eq("id", campaignRow.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await supabase.from("sv_ad_campaigns").update({ status: "failed", error_message: msg }).eq("id", campaignRow.id);
      throw new Error(`Campaign creation failed: ${msg}`);
    }

    // 2. Ad set
    const { data: adSetRow, error: adSetInsertErr } = await supabase
      .from("sv_ad_sets")
      .insert({
        user_id: userData.user.id,
        campaign_id: campaignRow.id,
        name: body.adSet.name,
        daily_budget_cents: body.adSet.dailyBudgetCents,
        start_time: body.adSet.startTime,
        end_time: body.adSet.endTime,
        targeting: body.adSet.targeting,
        status: "draft",
      })
      .select()
      .single();
    if (adSetInsertErr) throw new Error(adSetInsertErr.message);

    let metaAdSetId: string;
    try {
      metaAdSetId = await createAdSet(metaAdAccountId, token, {
        name: body.adSet.name,
        campaignId: metaCampaignId,
        objective: body.campaign.objective,
        dailyBudgetCents: body.adSet.dailyBudgetCents,
        startTime: body.adSet.startTime,
        endTime: body.adSet.endTime,
        targeting: body.adSet.targeting,
      });
      await supabase.from("sv_ad_sets").update({ meta_adset_id: metaAdSetId, status: "paused" }).eq("id", adSetRow.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await supabase.from("sv_ad_sets").update({ status: "failed", error_message: msg }).eq("id", adSetRow.id);
      return new Response(
        JSON.stringify({ ok: false, campaignId: campaignRow.id, adSetId: adSetRow.id, error: `Ad set creation failed: ${msg}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Creative + 4. Ad
    const { data: adRow, error: adInsertErr } = await supabase
      .from("sv_ads")
      .insert({
        user_id: userData.user.id,
        ad_set_id: adSetRow.id,
        name: body.ad.name,
        post_id: body.ad.postId ?? null,
        headline: body.ad.headline ?? null,
        body: body.ad.body ?? null,
        media_url: body.ad.mediaUrl ?? null,
        destination_url: body.ad.destinationUrl ?? null,
        call_to_action: body.ad.callToAction ?? null,
        status: "draft",
      })
      .select()
      .single();
    if (adInsertErr) throw new Error(adInsertErr.message);

    try {
      const creativeId = body.ad.postId
        ? await createCreativeFromPost(metaAdAccountId, token, pageId, body.ad.postId)
        : await createCreativeFromScratch(metaAdAccountId, token, {
            pageId,
            headline: body.ad.headline!,
            body: body.ad.body!,
            mediaUrl: body.ad.mediaUrl!,
            destinationUrl: body.ad.destinationUrl!,
            callToAction: body.ad.callToAction ?? "LEARN_MORE",
          });
      const metaAdId = await createAd(metaAdAccountId, token, { name: body.ad.name, adSetId: metaAdSetId, creativeId });
      await supabase.from("sv_ads").update({ meta_ad_id: metaAdId, status: "paused" }).eq("id", adRow.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await supabase.from("sv_ads").update({ status: "failed", error_message: msg }).eq("id", adRow.id);
      return new Response(
        JSON.stringify({ ok: false, campaignId: campaignRow.id, adSetId: adSetRow.id, adId: adRow.id, error: `Ad creation failed: ${msg}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, campaignId: campaignRow.id, adSetId: adSetRow.id, adId: adRow.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
