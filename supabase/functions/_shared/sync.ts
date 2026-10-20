// Shared by sync-account (user-triggered "Sync now", RLS-scoped client) and
// run-due-syncs (the cron job that auto-syncs accounts on their configured
// interval, service-role client) — same sync logic either way, just a
// different caller and a different Supabase client passed in.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { decryptToken, encryptToken } from "./crypto.ts";
import { syncWhatsApp } from "./whatsapp.ts";

export interface SyncResult {
  postsSynced: number;
  daysSynced: number;
  warnings: string[];
}

// ============================================================
// Facebook
// ============================================================

const GRAPH_VERSION = "v21.0";
// Safety valve, not a real-world expectation — stops an unusually large
// legacy Page from making this one sync run indefinitely.
const MAX_POSTS = 500;
// Meta only retains ~2 years of daily-granularity Page Insights regardless
// of how old the Page itself is, and caps each request to a ~90-day window.
const INSIGHTS_HISTORY_DAYS = 730;
const INSIGHTS_WINDOW_DAYS = 90;

// page_fans is deliberately not requested — Meta deprecated it from the
// Insights endpoint (current follower count comes from the Page node's
// fan_count field instead, fetched separately below). page_impressions was
// deprecated alongside it (Nov 15 2025); page_media_view (confirmed live,
// returns real varying daily numbers) is its replacement. page_impressions_unique
// ("reach") was tried too and returns (#100) invalid metric — same fate as
// post-level reach below, no working replacement published yet, so it's not
// requested at all rather than burning a call every sync that always fails.
// Each metric is requested and parsed independently so one future Meta
// deprecation doesn't take the whole sync down again — it just silently
// drops that field.
const INSIGHT_METRICS: { name: string; key: keyof DayMetrics }[] = [
  { name: "page_media_view", key: "impressions" },
  { name: "page_post_engagements", key: "engagement" },
];

interface DayMetrics {
  impressions?: number;
  reach?: number;
  engagement?: number;
}

async function fetchFacebookPosts(pageId: string, pageToken: string) {
  // Deliberately minimal fields — likes.summary(true)/comments.summary(true)
  // sub-edges sit behind a stricter gate ("Page Public Content Access") than
  // plain pages_read_engagement, so engagement is fetched separately (in
  // batches) instead of blocking the post list on that gate too.
  // deno-lint-ignore no-explicit-any
  const posts: any[] = [];
  let url =
    `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/posts` +
    `?fields=id,message,created_time,full_picture,permalink_url,attachments{media_type}` +
    `&limit=100&access_token=${encodeURIComponent(pageToken)}`;

  while (url && posts.length < MAX_POSTS) {
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) {
      if (posts.length > 0) break; // keep whatever pages already succeeded
      throw new Error(json.error?.message ?? `Facebook posts fetch failed (${res.status})`);
    }
    posts.push(...(json.data ?? []));
    url = json.paging?.next ?? null;
  }
  return posts.slice(0, MAX_POSTS);
}

interface Engagement {
  likes: number;
  comments: number;
  shares: number;
  impressions: number | null;
  reach: number | null;
}

// Facebook's Batch API packs up to 50 sub-requests into one HTTP call — the
// only way this scales to hundreds of posts instead of hundreds of
// round-trips (and hundreds of hits against the app's rate limit).
// Bundling likes/comments/shares and insights.metric(...) into ONE
// sub-request seemed safe (a rejected nested field "just comes back
// absent") but Facebook actually fails the WHOLE sub-request when any part
// of it is forbidden — so a rejected insights field was silently taking
// likes/comments/shares down with it. They're issued as two independent
// sub-requests per post now so one being forbidden can't sink the other.
// Per-post reach/impressions is NOT fetched here anymore. Both
// "post_impressions"/"post_impressions_unique" and the "post_media_view"
// replacement Meta's Nov 2025 changelog points to were tried live against a
// real Page and every combination returned (#100) "must be a valid
// insights metric" — confirmed via two separate deployed tests, not a
// guess. Meta has not published a working post-level views/reach metric as
// of this writing, so this is a real platform gap, not a bug here; retrying
// it every sync would just burn API calls against a call that always fails.
// impressions/reach stay null on every Facebook post until Meta ships one.
async function fetchEngagementBatch(
  // deno-lint-ignore no-explicit-any
  posts: any[],
  pageToken: string,
): Promise<{ engagements: Map<string, Engagement>; errors: { engagement?: string } }> {
  const result = new Map<string, Engagement>();
  const errors: { engagement?: string } = {};
  const CHUNK = 50; // one sub-request per post now, Facebook's batch cap is 50

  for (let i = 0; i < posts.length; i += CHUNK) {
    const chunk = posts.slice(i, i + CHUNK);
    const batch = chunk.map((p) => ({
      method: "GET",
      relative_url: `${p.id}?fields=likes.summary(true).limit(0),comments.summary(true).limit(0),shares`,
    }));
    try {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: pageToken, batch }),
      });
      const json = await res.json();
      if (!res.ok || !Array.isArray(json)) {
        errors.engagement ??= json?.error?.message ?? `Batch request failed (${res.status})`;
        continue;
      }

      const subError = (sub: { code?: number; body?: string }): string => {
        try {
          return JSON.parse(sub?.body ?? "{}")?.error?.message ?? `Sub-request failed (code ${sub?.code})`;
        } catch {
          return `Sub-request failed (code ${sub?.code})`;
        }
      };

      chunk.forEach((p, i) => {
        const engagementSub = json[i];
        const engagement: Engagement = { likes: 0, comments: 0, shares: 0, impressions: null, reach: null };

        if (engagementSub?.code === 200 && engagementSub.body) {
          try {
            const body = JSON.parse(engagementSub.body);
            engagement.likes = body.likes?.summary?.total_count ?? 0;
            engagement.comments = body.comments?.summary?.total_count ?? 0;
            engagement.shares = body.shares?.count ?? 0;
          } catch {
            errors.engagement ??= "Could not parse engagement response";
          }
        } else {
          errors.engagement ??= subError(engagementSub);
        }

        result.set(p.id, engagement);
      });
    } catch (error) {
      errors.engagement ??= error instanceof Error ? error.message : String(error);
    }
  }
  return { engagements: result, errors };
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchInsightsWindow(
  pageId: string,
  pageToken: string,
  since: Date,
  until: Date,
): Promise<{ points: { key: keyof DayMetrics; date: string; value: number }[]; errors: Map<string, string> }> {
  const points: { key: keyof DayMetrics; date: string; value: number }[] = [];
  const errors = new Map<string, string>();
  const results = await Promise.allSettled(
    INSIGHT_METRICS.map(async ({ name, key }) => {
      const url =
        `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/insights` +
        `?metric=${name}&period=day&since=${dateStr(since)}&until=${dateStr(until)}` +
        `&access_token=${encodeURIComponent(pageToken)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? `${name} fetch failed (${res.status})`);
      // deno-lint-ignore no-explicit-any
      const values = (json.data?.[0]?.values ?? []) as any[];
      return { key, name, values };
    }),
  );
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status !== "fulfilled") {
      errors.set(INSIGHT_METRICS[i].name, result.reason instanceof Error ? result.reason.message : String(result.reason));
      continue;
    }
    for (const point of result.value.values) {
      const value = typeof point.value === "number" ? point.value : 0;
      points.push({ key: result.value.key, date: String(point.end_time).slice(0, 10), value });
    }
  }
  return { points, errors };
}

// Walks backward in ~90-day windows for up to 2 years, in parallel — Meta
// simply returns empty for windows before the Page existed, which is a
// normal, harmless outcome here, not an error.
async function fetchFacebookInsights(pageId: string, pageToken: string) {
  const now = new Date();
  const windows: { since: Date; until: Date }[] = [];
  for (let offset = 0; offset < INSIGHTS_HISTORY_DAYS; offset += INSIGHTS_WINDOW_DAYS) {
    const until = new Date(now.getTime() - offset * 86400000);
    const since = new Date(now.getTime() - Math.min(offset + INSIGHTS_WINDOW_DAYS, INSIGHTS_HISTORY_DAYS) * 86400000);
    windows.push({ since, until });
  }

  const byDate = new Map<string, DayMetrics>();
  const metricErrors = new Map<string, string>();
  const windowResults = await Promise.all(
    windows.map((w) => fetchInsightsWindow(pageId, pageToken, w.since, w.until)),
  );
  for (const { points, errors } of windowResults) {
    for (const [name, msg] of errors) metricErrors.set(name, msg);
    for (const { key, date, value } of points) {
      const day = byDate.get(date) ?? {};
      day[key] = value;
      byDate.set(date, day);
    }
  }
  return { byDate, metricErrors };
}

async function fetchFacebookFollowerCount(pageId: string, pageToken: string): Promise<number | undefined> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}?fields=fan_count&access_token=${encodeURIComponent(pageToken)}`;
  const res = await fetch(url);
  const json = await res.json();
  return res.ok && typeof json.fan_count === "number" ? json.fan_count : undefined;
}

// deno-lint-ignore no-explicit-any
async function syncFacebook(supabase: SupabaseClient<any>, userId: string, account: any, accountId: string): Promise<SyncResult> {
  if (!account.page_access_token_ciphertext || !account.page_access_token_iv) {
    throw new Error("This account was connected before post/analytics sync was added — disconnect and reconnect Facebook to enable it.");
  }
  const pageToken = await decryptToken(account.page_access_token_ciphertext, account.page_access_token_iv);
  const pageId = account.platform_user_id as string;

  // Each of these three can fail independently (a Meta permission gate on
  // one shouldn't block the others from saving what they did get).
  const [postsResult, insightsResult, followerResult] = await Promise.allSettled([
    fetchFacebookPosts(pageId, pageToken),
    fetchFacebookInsights(pageId, pageToken),
    fetchFacebookFollowerCount(pageId, pageToken),
  ]);

  // deno-lint-ignore no-explicit-any
  const posts: any[] = postsResult.status === "fulfilled" ? postsResult.value : [];
  const insights = insightsResult.status === "fulfilled" ? insightsResult.value.byDate : new Map();
  const followerCount = followerResult.status === "fulfilled" ? followerResult.value : undefined;
  const warnings: string[] = [];
  if (postsResult.status === "rejected") warnings.push(`Posts: ${postsResult.reason}`);
  if (followerResult.status === "rejected") warnings.push(`Follower count: ${followerResult.reason}`);
  if (insightsResult.status === "fulfilled") {
    for (const [name, msg] of insightsResult.value.metricErrors) warnings.push(`Page insight "${name}": ${msg}`);
  }

  if (posts.length > 0) {
    const { engagements, errors: engagementErrors } = await fetchEngagementBatch(posts, pageToken);
    if (engagementErrors.engagement) warnings.push(`Likes/comments/shares: ${engagementErrors.engagement}`);
    const postRows = posts.map((p) => {
      const e = engagements.get(p.id);
      const fbType = p.attachments?.data?.[0]?.media_type as string | undefined;
      const mediaType =
        fbType === "photo" ? "image" :
        fbType === "video" ? "video" :
        fbType === "album" ? "carousel" :
        p.full_picture ? "image" : "text";
      return {
        user_id: userId,
        connected_account_id: accountId,
        platform: "facebook",
        platform_post_id: p.id,
        message: p.message ?? null,
        media_url: p.full_picture ?? null,
        media_type: mediaType,
        permalink_url: p.permalink_url ?? null,
        posted_at: p.created_time,
        likes_count: e?.likes ?? 0,
        comments_count: e?.comments ?? 0,
        shares_count: e?.shares ?? 0,
        impressions: e?.impressions ?? null,
        reach: e?.reach ?? null,
        fetched_at: new Date().toISOString(),
      };
    });
    const { error: postsErr } = await supabase
      .from("sv_platform_posts")
      .upsert(postRows, { onConflict: "connected_account_id,platform_post_id" });
    if (postsErr) throw new Error(postsErr.message);
  }

  if (insights.size > 0) {
    // Facebook no longer exposes a historical daily follower count, so the
    // current total is applied to every day in the window rather than
    // leaving it at a misleading 0 for days with no real data.
    const snapshotRows = [...insights.entries()].map(([date, day]) => ({
      user_id: userId,
      connected_account_id: accountId,
      platform: "facebook",
      metric_date: date,
      followers: followerCount ?? 0,
      impressions: day.impressions ?? 0,
      reach: day.reach ?? 0,
      engagement_rate: followerCount
        ? Math.min(99999.99, Math.round(((day.engagement ?? 0) / followerCount) * 10000) / 100)
        : 0,
    }));
    const { error: snapErr } = await supabase
      .from("sv_analytics_snapshots")
      .upsert(snapshotRows, { onConflict: "connected_account_id,metric_date" });
    if (snapErr) throw new Error(snapErr.message);
  }

  await supabase
    .from("sv_connected_accounts")
    .update({
      last_synced_at: new Date().toISOString(),
      ...(followerCount !== undefined ? { followers_count: followerCount } : {}),
      ...(posts.length > 0 ? { posts_count: posts.length } : {}),
    })
    .eq("id", accountId);

  return { postsSynced: posts.length, daysSynced: insights.size, warnings };
}

// ============================================================
// Instagram
// ============================================================

const IG_MAX_MEDIA = 500;

async function fetchInstagramMedia(igId: string, token: string) {
  // Unlike Facebook posts, Instagram's media edge already returns
  // like_count/comments_count directly — no separate engagement call needed.
  // deno-lint-ignore no-explicit-any
  const media: any[] = [];
  let url =
    `https://graph.facebook.com/${GRAPH_VERSION}/${igId}/media` +
    `?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count` +
    `&limit=50&access_token=${encodeURIComponent(token)}`;

  while (url && media.length < IG_MAX_MEDIA) {
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) {
      if (media.length > 0) break;
      throw new Error(json.error?.message ?? `Instagram media fetch failed (${res.status})`);
    }
    media.push(...(json.data ?? []));
    url = json.paging?.next ?? null;
  }
  return media.slice(0, IG_MAX_MEDIA);
}

// Per-media reach/impressions sit behind the same kind of permission gate
// Facebook's post insights did, so they're fetched independently per item
// (not batched — Instagram's Graph API batch support is the same
// facebook.com endpoint, but keeping this simple since IG accounts
// realistically post far less volume than a Facebook Page).
async function fetchInstagramInsights(mediaId: string, token: string): Promise<{ reach: number | null; impressions: number | null }> {
  try {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}/insights?metric=reach,impressions&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) return { reach: null, impressions: null };
    const byName = new Map((json.data ?? []).map((m: { name: string }) => [m.name, m]));
    // deno-lint-ignore no-explicit-any
    const valueOf = (name: string) => (byName.get(name) as any)?.values?.[0]?.value;
    const reach = valueOf("reach");
    const impressions = valueOf("impressions");
    return {
      reach: typeof reach === "number" ? reach : null,
      impressions: typeof impressions === "number" ? impressions : null,
    };
  } catch {
    return { reach: null, impressions: null };
  }
}

async function fetchInstagramFollowerCount(igId: string, token: string): Promise<number | undefined> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${igId}?fields=followers_count&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const json = await res.json();
  return res.ok && typeof json.followers_count === "number" ? json.followers_count : undefined;
}

// deno-lint-ignore no-explicit-any
async function syncInstagram(supabase: SupabaseClient<any>, userId: string, account: any, accountId: string): Promise<SyncResult> {
  if (!account.page_access_token_ciphertext || !account.page_access_token_iv) {
    throw new Error("This account was connected before post/analytics sync was added — disconnect and reconnect Instagram to enable it.");
  }
  const token = await decryptToken(account.page_access_token_ciphertext, account.page_access_token_iv);
  const igId = account.platform_user_id as string;
  const warnings: string[] = [];

  const [mediaResult, followerResult] = await Promise.allSettled([
    fetchInstagramMedia(igId, token),
    fetchInstagramFollowerCount(igId, token),
  ]);
  // deno-lint-ignore no-explicit-any
  const media: any[] = mediaResult.status === "fulfilled" ? mediaResult.value : [];
  const followerCount = followerResult.status === "fulfilled" ? followerResult.value : undefined;
  if (mediaResult.status === "rejected") warnings.push(`Posts: ${mediaResult.reason}`);
  if (followerResult.status === "rejected") warnings.push(`Follower count: ${followerResult.reason}`);

  if (media.length > 0) {
    const insightsResults = await Promise.all(media.map((m) => fetchInstagramInsights(m.id, token)));
    if (insightsResults.every((r) => r.reach === null && r.impressions === null)) {
      warnings.push("Reach/impressions: Instagram rejected per-media insights for this account (needs instagram_manage_insights).");
    }
    const postRows = media.map((m, i) => ({
      user_id: userId,
      connected_account_id: accountId,
      platform: "instagram",
      platform_post_id: m.id,
      message: m.caption ?? null,
      media_url: m.thumbnail_url ?? m.media_url ?? null,
      // Instagram already returns this per-media (IMAGE/VIDEO/CAROUSEL_ALBUM)
      // — it just wasn't being stored.
      media_type: m.media_type ? String(m.media_type).toLowerCase().replace("_album", "") : null,
      permalink_url: m.permalink ?? null,
      posted_at: m.timestamp,
      likes_count: m.like_count ?? 0,
      comments_count: m.comments_count ?? 0,
      shares_count: 0, // Instagram's API doesn't expose a share count
      impressions: insightsResults[i].impressions,
      reach: insightsResults[i].reach,
      fetched_at: new Date().toISOString(),
    }));
    const { error: postsErr } = await supabase
      .from("sv_platform_posts")
      .upsert(postRows, { onConflict: "connected_account_id,platform_post_id" });
    if (postsErr) throw new Error(postsErr.message);
  }

  // No daily history yet — Instagram's account-level Insights endpoint needs
  // instagram_manage_insights, not requested today. Today's real follower
  // count is stored so the trend chart at least has a true starting point.
  if (followerCount !== undefined) {
    await supabase.from("sv_analytics_snapshots").upsert(
      {
        user_id: userId,
        connected_account_id: accountId,
        platform: "instagram",
        metric_date: dateStr(new Date()),
        followers: followerCount,
        impressions: 0,
        reach: 0,
        engagement_rate: 0,
      },
      { onConflict: "connected_account_id,metric_date" },
    );
  }

  await supabase
    .from("sv_connected_accounts")
    .update({
      last_synced_at: new Date().toISOString(),
      ...(followerCount !== undefined ? { followers_count: followerCount } : {}),
      ...(media.length > 0 ? { posts_count: media.length } : {}),
    })
    .eq("id", accountId);

  return { postsSynced: media.length, daysSynced: followerCount !== undefined ? 1 : 0, warnings };
}

// ============================================================
// YouTube
// ============================================================

const YT_MAX_VIDEOS = 500;

// Google access tokens expire in ~1 hour (unlike Facebook's long-lived page
// tokens), so every sync has to be ready to refresh before it can do
// anything else. The refreshed token is written straight back to the row so
// the next sync doesn't have to refresh again until it's actually needed.
export async function getYouTubeAccessToken(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any>,
  // deno-lint-ignore no-explicit-any
  account: any,
  accountId: string,
): Promise<string> {
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  const stillFresh = expiresAt - Date.now() > 5 * 60 * 1000; // 5 min buffer
  const currentToken = await decryptToken(account.access_token_ciphertext, account.token_iv);
  if (stillFresh) return currentToken;

  if (!account.refresh_token_ciphertext || !account.refresh_iv) {
    throw new Error("This YouTube connection has expired and has no refresh token — disconnect and reconnect to fix it.");
  }
  const refreshToken = await decryptToken(account.refresh_token_ciphertext, account.refresh_iv);
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials missing on the server");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  // Read as text first — a raw res.json() call throws its own opaque
  // "Bad Request"-shaped error when Google's error body doesn't parse the
  // way expected, which was masking the real reason (invalid_grant, an
  // expired/revoked refresh token) behind a useless message every sync.
  const rawBody = await res.text();
  // deno-lint-ignore no-explicit-any
  let json: any = {};
  try {
    json = JSON.parse(rawBody);
  } catch {
    // fall through with an empty json — rawBody still gets surfaced below
  }
  if (!res.ok || !json.access_token) {
    const reason = json.error_description ?? json.error ?? rawBody ?? `HTTP ${res.status}`;
    throw new Error(`Google token refresh failed: ${reason}`);
  }

  const enc = await encryptToken(json.access_token);
  const newExpiresAt = json.expires_in ? new Date(Date.now() + json.expires_in * 1000).toISOString() : null;
    const rotatedRefresh = json.refresh_token ? await encryptToken(json.refresh_token) : null;
    const { error: saveError } = await supabase
    .from("sv_connected_accounts")
      .update({ access_token_ciphertext: enc.ciphertext, token_iv: enc.iv, token_expires_at: newExpiresAt,
        ...(rotatedRefresh ? { refresh_token_ciphertext: rotatedRefresh.ciphertext, refresh_iv: rotatedRefresh.iv } : {}),
      })
      .eq("id", accountId).eq("user_id", account.user_id);
    if (saveError) throw new Error("Could not save the refreshed YouTube authorization");

  return json.access_token;
}

async function fetchYouTubeChannel(channelId: string, token: string) {
  const url =
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,statistics` +
    `&id=${channelId}&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? `YouTube channel fetch failed (${res.status})`);
  const channel = json.items?.[0];
  if (!channel) throw new Error("YouTube channel not found");
  return {
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads as string | undefined,
    subscriberCount: Number(channel.statistics?.subscriberCount ?? 0),
    videoCount: Number(channel.statistics?.videoCount ?? 0),
  };
}

async function fetchYouTubeVideos(uploadsPlaylistId: string, token: string) {
  // deno-lint-ignore no-explicit-any
  const videos: any[] = [];
  let pageToken = "";
  while (videos.length < YT_MAX_VIDEOS) {
    const url =
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails` +
      `&playlistId=${uploadsPlaylistId}&maxResults=50` +
      (pageToken ? `&pageToken=${pageToken}` : "") +
      `&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) {
      if (videos.length > 0) break;
      throw new Error(json.error?.message ?? `YouTube video list failed (${res.status})`);
    }
    videos.push(...(json.items ?? []));
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }
  return videos.slice(0, YT_MAX_VIDEOS);
}

// videos.list accepts up to 50 comma-separated IDs per call — no need for a
// batch endpoint the way Facebook's per-object reads did.
async function fetchYouTubeStats(videoIds: string[], token: string): Promise<Map<string, { views: number; likes: number; comments: number }>> {
  const result = new Map<string, { views: number; likes: number; comments: number }>();
  const CHUNK = 50;
  for (let i = 0; i < videoIds.length; i += CHUNK) {
    const chunk = videoIds.slice(i, i + CHUNK);
    const url =
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${chunk.join(",")}` +
      `&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) continue; // this chunk's videos just keep 0 stats
    // deno-lint-ignore no-explicit-any
    for (const item of (json.items ?? []) as any[]) {
      result.set(item.id, {
        views: Number(item.statistics?.viewCount ?? 0),
        likes: Number(item.statistics?.likeCount ?? 0),
        comments: Number(item.statistics?.commentCount ?? 0),
      });
    }
  }
  return result;
}

interface YouTubeDay {
  date: string;
  views: number;
  gained: number;
  lost: number;
}

// The Analytics API only reports daily views + subscriber deltas, not a
// running subscriber total — so the actual daily count is reconstructed by
// walking backward from today's real total (from channels.list), subtracting
// each day's net change as we go. Unlike Facebook's insights, this is a
// single call for the whole window — no 90-day pagination needed.
async function fetchYouTubeAnalytics(channelId: string, token: string): Promise<YouTubeDay[]> {
  const until = new Date();
  const since = new Date(until.getTime() - INSIGHTS_HISTORY_DAYS * 86400000);
  const url =
    `https://youtubeanalytics.googleapis.com/v2/reports` +
    `?ids=channel%3D%3D${channelId}&startDate=${dateStr(since)}&endDate=${dateStr(until)}` +
    `&metrics=views,subscribersGained,subscribersLost&dimensions=day&sort=day` +
    `&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? `YouTube Analytics fetch failed (${res.status})`);

  // deno-lint-ignore no-explicit-any
  const headers = (json.columnHeaders ?? []) as any[];
  const idx = (name: string) => headers.findIndex((h) => h.name === name);
  const dayIdx = idx("day");
  const viewsIdx = idx("views");
  const gainedIdx = idx("subscribersGained");
  const lostIdx = idx("subscribersLost");

  // deno-lint-ignore no-explicit-any
  return ((json.rows ?? []) as any[][]).map((row) => ({
    date: row[dayIdx],
    views: Number(row[viewsIdx] ?? 0),
    gained: Number(row[gainedIdx] ?? 0),
    lost: Number(row[lostIdx] ?? 0),
  }));
}

// deno-lint-ignore no-explicit-any
async function syncYouTube(supabase: SupabaseClient<any>, userId: string, account: any, accountId: string): Promise<SyncResult> {
  const token = await getYouTubeAccessToken(supabase, account, accountId);
  const channelId = account.platform_user_id as string;
  const warnings: string[] = [];

  const channel = await fetchYouTubeChannel(channelId, token);
  if (!channel.uploadsPlaylistId) throw new Error("This channel has no uploads playlist");

  const videos = await fetchYouTubeVideos(channel.uploadsPlaylistId, token);
  const stats = videos.length > 0
    ? await fetchYouTubeStats(videos.map((v) => v.contentDetails?.videoId).filter(Boolean), token)
    : new Map();

  if (videos.length > 0) {
    const postRows = videos
      .filter((v) => v.contentDetails?.videoId)
      .map((v) => {
        const videoId = v.contentDetails.videoId as string;
        const s = stats.get(videoId);
        const thumb = v.snippet?.thumbnails?.high?.url ?? v.snippet?.thumbnails?.default?.url ?? null;
        return {
          user_id: userId,
          connected_account_id: accountId,
          platform: "youtube",
          platform_post_id: videoId,
          message: v.snippet?.title ?? null,
          media_url: thumb,
          media_type: "video", // every YouTube upload is a video, no ambiguity here
          permalink_url: `https://www.youtube.com/watch?v=${videoId}`,
          posted_at: v.contentDetails?.videoPublishedAt ?? v.snippet?.publishedAt,
          likes_count: s?.likes ?? 0,
          comments_count: s?.comments ?? 0,
          shares_count: 0, // YouTube's API doesn't expose a share count
          views_count: s?.views ?? null,
          fetched_at: new Date().toISOString(),
        };
      });
    const { error: postsErr } = await supabase
      .from("sv_platform_posts")
      .upsert(postRows, { onConflict: "connected_account_id,platform_post_id" });
    if (postsErr) throw new Error(postsErr.message);
  }

  let daysSynced = 0;
  try {
    const days = await fetchYouTubeAnalytics(channelId, token);
    if (days.length > 0) {
      // Walk backward from today's real total, undoing each day's net
      // change to recover that day's closing subscriber count.
      let balance = channel.subscriberCount;
      const snapshotRows = [];
      for (let i = days.length - 1; i >= 0; i--) {
        const d = days[i];
        snapshotRows.push({
          user_id: userId,
          connected_account_id: accountId,
          platform: "youtube",
          metric_date: d.date,
          followers: balance,
          impressions: d.views,
          reach: 0, // YouTube Analytics doesn't expose a unique-viewers metric at this tier
          engagement_rate: 0,
        });
        balance = balance - d.gained + d.lost;
      }
      const { error: snapErr } = await supabase
        .from("sv_analytics_snapshots")
        .upsert(snapshotRows, { onConflict: "connected_account_id,metric_date" });
      if (snapErr) throw new Error(snapErr.message);
      daysSynced = snapshotRows.length;
    }
  } catch (error) {
    warnings.push(`Daily trend history: ${error instanceof Error ? error.message : String(error)}`);
    // Fall back to at least today's real subscriber count rather than nothing.
    await supabase.from("sv_analytics_snapshots").upsert(
      {
        user_id: userId,
        connected_account_id: accountId,
        platform: "youtube",
        metric_date: dateStr(new Date()),
        followers: channel.subscriberCount,
        impressions: 0,
        reach: 0,
        engagement_rate: 0,
      },
      { onConflict: "connected_account_id,metric_date" },
    );
    daysSynced = 1;
  }

  await supabase
    .from("sv_connected_accounts")
    .update({
      last_synced_at: new Date().toISOString(),
      followers_count: channel.subscriberCount,
      posts_count: videos.length,
    })
    .eq("id", accountId);

  return { postsSynced: videos.length, daysSynced, warnings };
}

// ============================================================
// Dispatcher
// ============================================================

export async function syncAccount(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  // deno-lint-ignore no-explicit-any
  account: any,
  accountId: string,
): Promise<SyncResult> {
    if (account.user_id !== userId || account.id !== accountId) throw new Error("Account belongs to another user");
  if (account.platform === "facebook") {
    return await syncFacebook(supabase, userId, account, accountId);
  }
  if (account.platform === "youtube") {
    return await syncYouTube(supabase, userId, account, accountId);
  }
  if (account.platform === "instagram") {
    return await syncInstagram(supabase, userId, account, accountId);
  }
  if (account.platform === "whatsapp") {
    return await syncWhatsApp(supabase, account, accountId);
  }
    throw new Error("Analytics sync is not implemented for this platform yet");
}
