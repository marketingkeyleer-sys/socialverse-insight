import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken, encryptToken } from "@/lib/oauth/crypto.server";
import type { PlatformId } from "@/lib/oauth/providers.server";

type DashboardPlatform = "instagram" | "facebook" | "youtube" | "linkedin";

type ConnectedAccountRow = {
  id: string;
  user_id: string;
  platform: PlatformId;
  provider_account_id: string;
  account_handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  token_iv: string;
  refresh_iv: string | null;
  scopes: string[];
  expires_at: string | null;
  connected_at: string;
  meta: Record<string, unknown>;
};

type SeriesPoint = {
  date: string;
  label: string;
  reach: number;
  impressions: number;
  engagement: number;
};

type PlatformAnalytics = {
  id: DashboardPlatform;
  name: string;
  color: string;
  connected: boolean;
  live: boolean;
  accountName: string;
  avatarUrl: string | null;
  followers: number;
  reach: number;
  impressions: number;
  engagementRate: number;
  status: string;
  series: SeriesPoint[];
  topPosts: Array<{
    platform: string;
    title: string;
    reach: number;
    engagement: number;
    url?: string;
  }>;
};

const PLATFORM_META: Record<DashboardPlatform, { name: string; color: string }> = {
  instagram: { name: "Instagram", color: "var(--pink)" },
  facebook: { name: "Facebook Page", color: "var(--violet)" },
  youtube: { name: "YouTube", color: "var(--destructive)" },
  linkedin: { name: "LinkedIn", color: "var(--cyan)" },
};

const DASHBOARD_PLATFORMS = Object.keys(PLATFORM_META) as DashboardPlatform[];

function compact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function percent(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

function dateRange(days = 30) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const points: SeriesPoint[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    points.push({
      date: iso,
      label: d.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" }),
      reach: 0,
      impressions: 0,
      engagement: 0,
    });
  }
  return { start, end, points };
}

function emptyPlatform(id: DashboardPlatform, connected = false, account?: ConnectedAccountRow): PlatformAnalytics {
  const meta = PLATFORM_META[id];
  return {
    id,
    name: meta.name,
    color: meta.color,
    connected,
    live: false,
    accountName: account?.display_name ?? account?.account_handle ?? "Not connected",
    avatarUrl: account?.avatar_url ?? null,
    followers: 0,
    reach: 0,
    impressions: 0,
    engagementRate: 0,
    status: connected ? "Connected — analytics permission or account data is not available yet" : "Connect account to load live analytics",
    series: dateRange().points,
    topPosts: [],
  };
}

async function fetchJson(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const message = json?.error?.message ?? json?.message ?? text;
    throw new Error(`Provider API returned ${res.status}: ${message}`);
  }
  return json;
}

async function usableAccessToken(account: ConnectedAccountRow) {
  const accessToken = await decryptToken(account.access_token_ciphertext, account.token_iv);
  const expiresAt = account.expires_at ? new Date(account.expires_at).getTime() : null;
  if (account.platform !== "youtube" || !expiresAt || expiresAt > Date.now() + 120_000) return accessToken;
  if (!account.refresh_token_ciphertext || !account.refresh_iv) return accessToken;

  const refreshToken = await decryptToken(account.refresh_token_ciphertext, account.refresh_iv);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return accessToken;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenJson: any = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) return accessToken;

  const encrypted = await encryptToken(tokenJson.access_token);
  await supabaseAdmin
    .from("connected_accounts")
    .update({
      access_token_ciphertext: encrypted.ciphertext,
      token_iv: encrypted.iv,
      expires_at: tokenJson.expires_in
        ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
        : account.expires_at,
    })
    .eq("id", account.id);
  return tokenJson.access_token as string;
}

function mergeSeries(target: SeriesPoint[], source: SeriesPoint[]) {
  const byDate = new Map(target.map((p) => [p.date, p]));
  for (const point of source) {
    const existing = byDate.get(point.date);
    if (!existing) continue;
    existing.reach += point.reach || 0;
    existing.impressions += point.impressions || 0;
    existing.engagement += point.engagement || 0;
  }
  return target;
}

function metaInsightSeries(insights: any, metricMap: Record<string, keyof Omit<SeriesPoint, "date" | "label">>) {
  const { points } = dateRange();
  const byDate = new Map(points.map((p) => [p.date, p]));
  for (const metric of insights?.data ?? []) {
    const key = metricMap[metric.name];
    if (!key) continue;
    for (const value of metric.values ?? []) {
      const date = String(value.end_time ?? "").slice(0, 10);
      const point = byDate.get(date);
      if (point) point[key] += Number(value.value) || 0;
    }
  }
  return points;
}

function totalsFromSeries(series: SeriesPoint[]) {
  const reach = series.reduce((sum, p) => sum + p.reach, 0);
  const impressions = series.reduce((sum, p) => sum + p.impressions, 0);
  const engagement = series.reduce((sum, p) => sum + p.engagement, 0);
  return { reach, impressions, engagement, engagementRate: reach ? (engagement / reach) * 100 : 0 };
}

function topMetaPosts(posts: any, platform: string) {
  return (posts?.data ?? [])
    .map((post: any) => {
      const insights = new Map((post.insights?.data ?? []).map((i: any) => [i.name, Number(i.values?.[0]?.value) || 0]));
      const engagement = Number(insights.get("post_engaged_users")) || Number(post.reactions?.summary?.total_count || 0) + Number(post.comments?.summary?.total_count || 0);
      return {
        platform,
        title: String(post.message ?? post.caption ?? "Untitled post").slice(0, 90),
        reach: Number(insights.get("post_impressions_unique")) || Number(insights.get("post_impressions")) || 0,
        engagement,
        url: post.permalink_url,
      };
    })
    .sort((a: any, b: any) => b.reach - a.reach)
    .slice(0, 8);
}

async function fetchFacebook(account: ConnectedAccountRow): Promise<PlatformAnalytics> {
  const token = await usableAccessToken(account);
  const { start, end } = dateRange();
  const pageList = await fetchJson(
    "https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,fan_count,picture{url}&limit=25",
    token,
  );
  const page = pageList?.data?.[0];
  if (!page?.id || !page?.access_token) {
    return { ...emptyPlatform("facebook", true, account), status: "No Facebook Page was found for this login" };
  }

  const since = Math.floor(start.getTime() / 1000);
  const until = Math.floor(end.getTime() / 1000);
  let series = dateRange().points;
  try {
    const insights = await fetchJson(
      `https://graph.facebook.com/v21.0/${page.id}/insights?metric=page_impressions,page_impressions_unique,page_post_engagements&period=day&since=${since}&until=${until}`,
      page.access_token,
    );
    series = metaInsightSeries(insights, {
      page_impressions: "impressions",
      page_impressions_unique: "reach",
      page_post_engagements: "engagement",
    });
  } catch {
    series = dateRange().points;
  }

  let topPosts: PlatformAnalytics["topPosts"] = [];
  try {
    const posts = await fetchJson(
      `https://graph.facebook.com/v21.0/${page.id}/posts?fields=id,message,permalink_url,insights.metric(post_impressions,post_impressions_unique,post_engaged_users),reactions.summary(true),comments.summary(true)&limit=10`,
      page.access_token,
    );
    topPosts = topMetaPosts(posts, "Facebook");
  } catch {
    topPosts = [];
  }

  const totals = totalsFromSeries(series);
  return {
    ...emptyPlatform("facebook", true, account),
    live: true,
    accountName: page.name ?? account.display_name ?? "Facebook Page",
    avatarUrl: page.picture?.data?.url ?? account.avatar_url,
    followers: Number(page.fan_count) || 0,
    ...totals,
    status: "Live Facebook Page analytics",
    series,
    topPosts,
  };
}

async function fetchInstagram(account: ConnectedAccountRow): Promise<PlatformAnalytics> {
  const token = await usableAccessToken(account);
  const { start, end } = dateRange();
  const pageList = await fetchJson(
    "https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}&limit=25",
    token,
  );
  const page = (pageList?.data ?? []).find((item: any) => item.instagram_business_account);
  const ig = page?.instagram_business_account;
  if (!page?.access_token || !ig?.id) {
    return { ...emptyPlatform("instagram", true, account), status: "No Instagram Business or Creator account was found" };
  }

  const since = Math.floor(start.getTime() / 1000);
  const until = Math.floor(end.getTime() / 1000);
  let series = dateRange().points;
  try {
    const insights = await fetchJson(
      `https://graph.facebook.com/v21.0/${ig.id}/insights?metric=reach,impressions,profile_views&period=day&since=${since}&until=${until}`,
      page.access_token,
    );
    series = metaInsightSeries(insights, { reach: "reach", impressions: "impressions", profile_views: "engagement" });
  } catch {
    series = dateRange().points;
  }

  let topPosts: PlatformAnalytics["topPosts"] = [];
  try {
    const media = await fetchJson(
      `https://graph.facebook.com/v21.0/${ig.id}/media?fields=id,caption,permalink,like_count,comments_count,insights.metric(reach,impressions)&limit=10`,
      page.access_token,
    );
    topPosts = topMetaPosts(media, "Instagram").map((post) => ({
      ...post,
      engagement: post.engagement || 0,
    }));
  } catch {
    topPosts = [];
  }

  const totals = totalsFromSeries(series);
  return {
    ...emptyPlatform("instagram", true, account),
    live: true,
    accountName: ig.username ? `@${ig.username}` : ig.name ?? "Instagram account",
    avatarUrl: ig.profile_picture_url ?? account.avatar_url,
    followers: Number(ig.followers_count) || 0,
    ...totals,
    status: "Live Instagram account analytics",
    series,
    topPosts,
  };
}

async function fetchYouTube(account: ConnectedAccountRow): Promise<PlatformAnalytics> {
  const token = await usableAccessToken(account);
  const channelJson = await fetchJson(
    "https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true",
    token,
  );
  const channel = channelJson.items?.[0];
  if (!channel) return { ...emptyPlatform("youtube", true, account), status: "No YouTube channel was found for this login" };

  const { start, end, points } = dateRange();
  let series = points;
  try {
    const report = await fetchJson(
      `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${start.toISOString().slice(0, 10)}&endDate=${end.toISOString().slice(0, 10)}&metrics=views,likes,comments,shares,subscribersGained&dimensions=day&sort=day`,
      token,
    );
    const byDate = new Map(points.map((p) => [p.date, p]));
    for (const row of report.rows ?? []) {
      const point = byDate.get(row[0]);
      if (!point) continue;
      point.reach = Number(row[1]) || 0;
      point.impressions = Number(row[1]) || 0;
      point.engagement = (Number(row[2]) || 0) + (Number(row[3]) || 0) + (Number(row[4]) || 0);
    }
    series = points;
  } catch {
    series = points;
  }

  let topPosts: PlatformAnalytics["topPosts"] = [];
  try {
    const playlistId = channel.contentDetails?.relatedPlaylists?.uploads;
    if (playlistId) {
      const playlist = await fetchJson(
        `https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=15`,
        token,
      );
      const ids = (playlist.items ?? []).map((item: any) => item.contentDetails?.videoId).filter(Boolean).join(",");
      if (ids) {
        const videos = await fetchJson(
          `https://youtube.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids}`,
          token,
        );
        topPosts = (videos.items ?? [])
          .map((video: any) => ({
            platform: "YouTube",
            title: video.snippet?.title ?? "Untitled video",
            reach: Number(video.statistics?.viewCount) || 0,
            engagement: (Number(video.statistics?.likeCount) || 0) + (Number(video.statistics?.commentCount) || 0),
            url: `https://www.youtube.com/watch?v=${video.id}`,
          }))
          .sort((a: any, b: any) => b.reach - a.reach)
          .slice(0, 8);
      }
    }
  } catch {
    topPosts = [];
  }

  const totals = totalsFromSeries(series);
  return {
    ...emptyPlatform("youtube", true, account),
    live: true,
    accountName: channel.snippet?.title ?? account.display_name ?? "YouTube channel",
    avatarUrl: channel.snippet?.thumbnails?.default?.url ?? account.avatar_url,
    followers: Number(channel.statistics?.subscriberCount) || 0,
    reach: totals.reach || Number(channel.statistics?.viewCount) || 0,
    impressions: totals.impressions || Number(channel.statistics?.viewCount) || 0,
    engagementRate: totals.engagementRate,
    status: "Live YouTube channel analytics",
    series,
    topPosts,
  };
}

function firstNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(firstNumber).find(Boolean) ?? 0;
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(firstNumber).find(Boolean) ?? 0;
  }
  return 0;
}

async function fetchLinkedIn(account: ConnectedAccountRow): Promise<PlatformAnalytics> {
  const token = await usableAccessToken(account);
  const headers = { "LinkedIn-Version": "202401", "X-Restli-Protocol-Version": "2.0.0" };
  const me = await fetchJson("https://api.linkedin.com/v2/userinfo", token);
  let followers = 0;
  let status = "Connected — LinkedIn personal profile analytics are limited by LinkedIn";
  try {
    const orgs = await fetchJson(
      "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organization~(id,localizedName,vanityName)))",
      token,
      { headers },
    );
    const org = orgs.elements?.[0]?.["organization~"];
    if (org?.id) {
      const stats = await fetchJson(
        `https://api.linkedin.com/v2/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn%3Ali%3Aorganization%3A${org.id}`,
        token,
        { headers },
      );
      followers = firstNumber(stats.elements?.[0]) || 0;
      status = `Live LinkedIn organization access${org.localizedName ? ` · ${org.localizedName}` : ""}`;
    }
  } catch {
    followers = 0;
  }

  return {
    ...emptyPlatform("linkedin", true, account),
    live: true,
    accountName: me.name ?? account.display_name ?? "LinkedIn account",
    avatarUrl: me.picture ?? account.avatar_url,
    followers,
    status,
  };
}

async function fetchPlatformAnalytics(account: ConnectedAccountRow): Promise<PlatformAnalytics> {
  try {
    if (account.platform === "facebook") return fetchFacebook(account);
    if (account.platform === "instagram") return fetchInstagram(account);
    if (account.platform === "youtube") return fetchYouTube(account);
    if (account.platform === "linkedin") return fetchLinkedIn(account);
  } catch (error) {
    const id = account.platform as DashboardPlatform;
    return {
      ...emptyPlatform(id, true, account),
      status: error instanceof Error ? error.message : "Provider analytics could not be loaded",
    };
  }
  return emptyPlatform(account.platform as DashboardPlatform, true, account);
}

export const getSocialDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("connected_accounts")
      .select("*")
      .eq("user_id", context.userId)
      .in("platform", DASHBOARD_PLATFORMS);
    if (error) throw new Error(error.message);

    const latestByPlatform = new Map<DashboardPlatform, ConnectedAccountRow>();
    for (const row of (data ?? []) as ConnectedAccountRow[]) {
      const platform = row.platform as DashboardPlatform;
      if (!DASHBOARD_PLATFORMS.includes(platform)) continue;
      const existing = latestByPlatform.get(platform);
      if (!existing || new Date(row.connected_at).getTime() > new Date(existing.connected_at).getTime()) {
        latestByPlatform.set(platform, row);
      }
    }

    const platformResults = await Promise.all(
      DASHBOARD_PLATFORMS.map((platform) => {
        const account = latestByPlatform.get(platform);
        return account ? fetchPlatformAnalytics(account) : Promise.resolve(emptyPlatform(platform));
      }),
    );

    const growthSeries = dateRange().points;
    for (const platform of platformResults) mergeSeries(growthSeries, platform.series);

    const totalFollowers = platformResults.reduce((sum, p) => sum + p.followers, 0);
    const totalReach = growthSeries.reduce((sum, p) => sum + p.reach, 0);
    const totalImpressions = growthSeries.reduce((sum, p) => sum + p.impressions, 0);
    const totalEngagement = growthSeries.reduce((sum, p) => sum + p.engagement, 0);
    const engagementRate = totalReach ? (totalEngagement / totalReach) * 100 : 0;
    const liveCount = platformResults.filter((p) => p.live).length;
    const connectedCount = platformResults.filter((p) => p.connected).length;

    return {
      generatedAt: new Date().toISOString(),
      connectedCount,
      liveCount,
      kpis: [
        { label: "Total Followers", value: compact(totalFollowers), detail: "Across connected accounts", accent: "violet" },
        { label: "Reach", value: compact(totalReach), detail: "Last 30 days", accent: "cyan" },
        { label: "Impressions", value: compact(totalImpressions), detail: "Last 30 days", accent: "pink" },
        { label: "Engagement", value: percent(engagementRate), detail: "Reach-based rate", accent: "lime" },
        { label: "Connected", value: String(connectedCount), detail: "Social accounts", accent: "amber" },
        { label: "Live Data", value: String(liveCount), detail: "Providers responding", accent: "violet" },
      ],
      growthSeries,
      platformShare: platformResults
        .filter((p) => p.followers > 0)
        .map((p) => ({ name: p.name, value: p.followers, color: p.color })),
      platforms: platformResults,
      topPosts: platformResults.flatMap((p) => p.topPosts).sort((a, b) => b.reach - a.reach).slice(0, 12),
      notices: platformResults.filter((p) => p.connected && !p.live).map((p) => ({ platform: p.name, message: p.status })),
    };
  });