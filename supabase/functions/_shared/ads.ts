// Meta Marketing API — campaigns/ad sets/ads/insights, used by the Ads
// Manager feature. This is Meta's oldest, most stable public API surface
// (unlike the Insights endpoints that just got overhauled), but none of it
// can be live-verified until ads_management is approved for this app.
//
// Safety default: every create call below sets status: "PAUSED". Nothing
// created through this file ever starts spending on its own — a campaign
// only spends once a separate, explicit "activate" call flips it to ACTIVE.
const GRAPH_VERSION = "v21.0";
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

async function graphPost(path: string, token: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: token }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? `Marketing API call failed (${res.status})`);
  return json;
}

async function graphGet(path: string, token: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${BASE}/${path}?${qs}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? `Marketing API call failed (${res.status})`);
  return json;
}

export interface MetaAdAccount {
  id: string; // "act_123..."
  name: string | null;
  currency: string | null;
  accountStatus: number | null;
}

export async function listAdAccounts(token: string): Promise<MetaAdAccount[]> {
  const json = await graphGet("me/adaccounts", token, { fields: "id,name,currency,account_status", limit: "100" });
  // deno-lint-ignore no-explicit-any
  return ((json.data ?? []) as any[]).map((a) => ({
    id: a.id,
    name: a.name ?? null,
    currency: a.currency ?? null,
    accountStatus: a.account_status ?? null,
  }));
}

const OPTIMIZATION_GOAL: Record<string, string> = {
  OUTCOME_AWARENESS: "REACH",
  OUTCOME_ENGAGEMENT: "POST_ENGAGEMENT",
  OUTCOME_TRAFFIC: "LINK_CLICKS",
  OUTCOME_LEADS: "LEAD_GENERATION",
  OUTCOME_SALES: "OFFSITE_CONVERSIONS",
};

export async function createCampaign(
  adAccountId: string,
  token: string,
  name: string,
  objective: string,
): Promise<string> {
  const json = await graphPost(`${adAccountId}/campaigns`, token, {
    name,
    objective,
    status: "PAUSED",
    special_ad_categories: [],
  });
  return json.id as string;
}

export interface Targeting {
  ageMin: number;
  ageMax: number;
  genders: number[]; // 0=all, 1=male, 2=female (Meta's own encoding)
  countries: string[]; // ISO country codes
}

export async function createAdSet(
  adAccountId: string,
  token: string,
  params: {
    name: string;
    campaignId: string;
    objective: string;
    dailyBudgetCents: number;
    startTime: string;
    endTime: string | null;
    targeting: Targeting;
  },
): Promise<string> {
  const json = await graphPost(`${adAccountId}/adsets`, token, {
    name: params.name,
    campaign_id: params.campaignId,
    daily_budget: params.dailyBudgetCents,
    billing_event: "IMPRESSIONS",
    optimization_goal: OPTIMIZATION_GOAL[params.objective] ?? "REACH",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    start_time: params.startTime,
    ...(params.endTime ? { end_time: params.endTime } : {}),
    targeting: {
      geo_locations: { countries: params.targeting.countries.length > 0 ? params.targeting.countries : ["US"] },
      age_min: params.targeting.ageMin,
      age_max: params.targeting.ageMax,
      genders: params.targeting.genders.length > 0 ? params.targeting.genders : [0],
      publisher_platforms: ["facebook", "instagram"],
    },
    status: "PAUSED",
  });
  return json.id as string;
}

// Boosts an already-published Facebook post — Meta re-wraps that post as
// the ad's creative directly, no new creative content needed.
export async function createCreativeFromPost(
  adAccountId: string,
  token: string,
  pageId: string,
  postId: string,
): Promise<string> {
  const json = await graphPost(`${adAccountId}/adcreatives`, token, {
    object_story_id: `${pageId}_${postId}`,
  });
  return json.id as string;
}

export async function createCreativeFromScratch(
  adAccountId: string,
  token: string,
  params: { pageId: string; headline: string; body: string; mediaUrl: string; destinationUrl: string; callToAction: string },
): Promise<string> {
  const json = await graphPost(`${adAccountId}/adcreatives`, token, {
    object_story_spec: {
      page_id: params.pageId,
      link_data: {
        message: params.body,
        name: params.headline,
        link: params.destinationUrl,
        picture: params.mediaUrl,
        call_to_action: { type: params.callToAction, value: { link: params.destinationUrl } },
      },
    },
  });
  return json.id as string;
}

export async function createAd(
  adAccountId: string,
  token: string,
  params: { name: string; adSetId: string; creativeId: string },
): Promise<string> {
  const json = await graphPost(`${adAccountId}/ads`, token, {
    name: params.name,
    adset_id: params.adSetId,
    creative: { creative_id: params.creativeId },
    status: "PAUSED",
  });
  return json.id as string;
}

export async function setStatus(
  objectId: string,
  token: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  await graphPost(objectId, token, { status });
}

export interface AdInsights {
  spendCents: number;
  impressions: number;
  clicks: number;
  reach: number;
}

export async function fetchAdInsights(adId: string, token: string): Promise<AdInsights | null> {
  const json = await graphGet(`${adId}/insights`, token, { fields: "spend,impressions,clicks,reach" });
  // deno-lint-ignore no-explicit-any
  const row = (json.data as any[])?.[0];
  if (!row) return null;
  return {
    spendCents: Math.round(Number(row.spend ?? 0) * 100),
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    reach: Number(row.reach ?? 0),
  };
}
