import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { providerGet, uploadPostAccountPage } from "./uploadpost.ts";

const metric = (value: unknown): number | undefined => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
const publicUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null; } catch { return null; }
};

// All requests include the immutable organization ID. Omitting it would let
// the provider silently choose the member's first Page and mix brand data.
export async function syncUploadPostPage(supabase: SupabaseClient, userId: string, account: any, accountId: string) {
  if (account.user_id !== userId || account.id !== accountId) throw new Error("Account belongs to another user");
  const { binding, page } = await uploadPostAccountPage(account);
  const query = new URLSearchParams({ platform: "linkedin", user: binding.profile, page_urn: binding.pageId, limit: "100" });
  const response = await providerGet(`/api/uploadposts/media?${query}`);
  if (!Array.isArray(response.media)) throw new Error("LinkedIn provider returned an invalid post list");
  const warnings: string[] = [];
  const media = response.media.filter((post: any) => typeof post.id === "string" && /^urn:li:(share|ugcPost|activity):\d+$/.test(post.id) && Number.isFinite(Date.parse(post.timestamp)));
  if (media.length !== response.media.length) warnings.push("Some posts had invalid identifiers or dates and were not imported.");
  const metrics = new Map<string, Record<string, unknown>>();
  // Keep each Edge Function run bounded and below the vendor's analytics rate
  // limit. Refresh the twenty most recent posts; older saved counters remain.
  const recent = [...media].sort((a: any, b: any) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 20);
  let unavailable = 0;
  for (let offset = 0; offset < recent.length; offset += 5) {
    await Promise.all(recent.slice(offset, offset + 5).map(async (post: any) => {
      try {
        const params = new URLSearchParams({ platform: "linkedin", user: binding.profile, platform_post_id: post.id, page_urn: binding.pageId });
        const data = await providerGet(`/api/uploadposts/post-analytics?${params}`);
        const result = data.platforms?.linkedin;
        if (!result?.post_metrics || result.post_metrics_error || result.platform_post_id !== post.id) { unavailable++; return; }
        metrics.set(post.id, result.post_metrics);
      } catch { unavailable++; }
    }));
  }
  const fetchedAt = new Date().toISOString();
  for (const post of media) {
    const stats = metrics.get(post.id);
    // Omit unavailable counters rather than overwrite previously fetched data.
    const counters = Object.fromEntries([
      ["likes_count", metric(stats?.likes ?? stats?.reactions)], ["comments_count", metric(stats?.comments)],
      ["shares_count", metric(stats?.shares)], ["impressions", metric(stats?.impressions)],
      ["reach", metric(stats?.reach)], ["views_count", metric(stats?.views)],
    ].filter(([, value]) => value !== undefined));
    const { error } = await supabase.from("sv_platform_posts").upsert({
      user_id: userId, connected_account_id: accountId, platform: "linkedin_page", platform_post_id: post.id,
      message: typeof post.caption === "string" ? post.caption : null, posted_at: new Date(post.timestamp).toISOString(),
      permalink_url: publicUrl(post.permalink), media_url: publicUrl(post.media_url ?? post.thumbnail_url),
      media_type: String(post.media_type ?? "text").toLowerCase(), fetched_at: fetchedAt, ...counters,
    }, { onConflict: "connected_account_id,platform_post_id" });
    if (error) throw new Error("Could not save LinkedIn post details");
  }
  const { count, error: countError } = await supabase.from("sv_platform_posts").select("id", { count: "exact", head: true }).eq("connected_account_id", accountId).eq("user_id", userId);
  if (countError) throw new Error("Could not count saved LinkedIn posts");
  const { error } = await supabase.from("sv_connected_accounts").update({
    last_synced_at: fetchedAt, ...(metric(page.followers) !== undefined ? { followers_count: page.followers } : {}),
    posts_count: count ?? media.length,
  }).eq("id", accountId).eq("user_id", userId);
  if (error) throw new Error("Could not update LinkedIn sync status");
  if (unavailable) warnings.push(`Engagement metrics were unavailable for ${unavailable} recent posts. Previously stored values were retained; newly imported posts may show default counters until metrics are available.`);
  warnings.push("LinkedIn monitoring imports up to 100 recent Page posts and refreshes engagement for the latest 20. Full historical analytics and daily reach trends are not available in this sync.");
  return { postsSynced: media.length, daysSynced: 0, warnings };
}
