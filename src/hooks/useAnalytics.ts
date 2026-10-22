import { useBrandScope } from "@/contexts/BrandContext";
import { postBrandFilter } from "@/lib/brandScope";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { AnalyticsSnapshot, Platform } from "@/types/database";
import { followerTotals } from "@/lib/analyticsTotals";
import { hasSnapshotMetric } from "@/lib/chartMetrics";

export interface DateRange {
  from: Date;
  to: Date;
}

export function last(days: number): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from, to };
}

export function thisMonth(): DateRange {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { from, to };
}

export interface AnalyticsAggregates {
  totalFollowers: number;
  totalImpressions: number;
  totalReach: number;
  avgEngagementRate: number;
  followersChangePct: number;
  impressionsChangePct: number;
}

export interface PlatformPerformance {
  platform: Platform;
  reach: number;
  impressions: number;
  followers: number;
  followersChangePct: number;
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function useAnalytics(range: DateRange, platform?: Platform) {
  const { user } = useAuth();
  const scope = useBrandScope();

  const query = useQuery({
    queryKey: ["analytics", user?.id, scope.brandId, scope.accountIds, range.from.toISOString(), range.to.toISOString(), platform],
    queryFn: async () => {
      let q = supabase
        .from("sv_analytics_snapshots")
        .select("*")
        .in("connected_account_id", scope.accountIds)
        .gte("metric_date", range.from.toISOString().slice(0, 10))
        .lte("metric_date", range.to.toISOString().slice(0, 10))
        .order("metric_date", { ascending: true })
        // PostgREST defaults to a 1000-row cap — a couple of platforms over
        // a year of daily history clears that easily, which would silently
        // truncate the range rather than error.
        .limit(5000);
      if (platform) q = q.eq("platform", platform);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: Boolean(user?.id) && scope.ready,
  });

  const aggregates = computeAggregates(query.data ?? []);
  const platformPerformance = computePlatformPerformance(query.data ?? []);

  return { ...query, aggregates, platformPerformance };
}

// Per-platform totals for the same window, so the dashboard can call out
// which platform is actually winning on reach instead of only showing
// combined numbers.
export function computePlatformPerformance(snapshots: AnalyticsSnapshot[]): PlatformPerformance[] {
  const byPlatform = new Map<Platform, AnalyticsSnapshot[]>();
  for (const s of snapshots) {
    const platform = s.platform as Platform;
    byPlatform.set(platform, [...(byPlatform.get(platform) ?? []), s]);
  }

  return [...byPlatform.entries()]
    .map(([platform, rows]) => {
      const totals = followerTotals(rows);
      const latestFollowers = totals.last;
      const earliestFollowers = totals.first;
      return {
        platform,
        reach: rows.reduce((sum, s) => sum + s.reach, 0),
        impressions: rows.reduce((sum, s) => sum + s.impressions, 0),
        followers: latestFollowers,
        followersChangePct: pctChange(latestFollowers, earliestFollowers),
      };
    })
    .sort((a, b) => b.reach - a.reach);
}

export function computeAggregates(snapshots: AnalyticsSnapshot[]): AnalyticsAggregates {
  if (snapshots.length === 0) {
    return { totalFollowers: 0, totalImpressions: 0, totalReach: 0, avgEngagementRate: 0, followersChangePct: 0, impressionsChangePct: 0 };
  }

  const byDate = new Map<string, AnalyticsSnapshot[]>();
  for (const s of snapshots) {
    const bucket = byDate.get(s.metric_date) ?? [];
    bucket.push(s);
    byDate.set(s.metric_date, bucket);
  }
  const dates = [...byDate.keys()].sort();
  const totals = followerTotals(snapshots);
  const totalFollowers = totals.last;
  const earliestFollowers = totals.first;
  const totalImpressions = snapshots.reduce((sum, s) => sum + s.impressions, 0);
  const totalReach = snapshots.reduce((sum, s) => sum + s.reach, 0);
  const engagementRows = snapshots.filter(row => hasSnapshotMetric(row,"engagement_rate"));
  const avgEngagementRate = engagementRows.length ? engagementRows.reduce((sum, s) => sum + Number(s.engagement_rate), 0) / engagementRows.length : 0;

  const midpoint = Math.floor(dates.length / 2) || 1;
  const firstHalfImpressions = dates
    .slice(0, midpoint)
    .flatMap((d) => byDate.get(d) ?? [])
    .reduce((sum, s) => sum + s.impressions, 0);
  const secondHalfImpressions = dates
    .slice(midpoint)
    .flatMap((d) => byDate.get(d) ?? [])
    .reduce((sum, s) => sum + s.impressions, 0);

  return {
    totalFollowers,
    totalImpressions,
    totalReach,
    avgEngagementRate,
    followersChangePct: pctChange(totalFollowers, earliestFollowers),
    impressionsChangePct: pctChange(secondHalfImpressions, firstHalfImpressions),
  };
}

// sv_analytics_snapshots has a `likes` column, but nothing real ever writes
// to it — sync-account only ever set followers/impressions/reach/
// engagement_rate there. Real likes live per-post in sv_platform_posts.
export function useTotalLikes(range: DateRange, platform?: Platform) {
  const { user } = useAuth();
  const scope = useBrandScope();

  return useQuery({
    queryKey: ["total-likes", user?.id, scope.brandId, scope.accountIds, range.from.toISOString(), range.to.toISOString(), platform],
    queryFn: async () => {
      let q = supabase
        .from("sv_platform_posts")
        .select("likes_count")
        .in("connected_account_id", scope.accountIds)
        .gte("posted_at", range.from.toISOString())
        .lte("posted_at", range.to.toISOString())
        .limit(5000);
      if (platform) q = q.eq("platform", platform);

      const { data, error } = await q;
      if (error) throw error;
      return data.reduce((sum, p) => sum + p.likes_count, 0);
    },
    enabled: Boolean(user?.id) && scope.ready,
  });
}

// "Posts this month" was reading sv_posts (only what was composed inside
// SocialVerse) instead of sv_platform_posts (every real post on the
// connected accounts, synced in) — for most accounts that's near-zero even
// when the real page has posted a lot this month. Count the real source.
export function usePostCount(range: DateRange, platform?: Platform) {
  const { user } = useAuth();
  const scope = useBrandScope();

  return useQuery({
    queryKey: ["post-count", user?.id, scope.brandId, scope.accountIds, range.from.toISOString(), range.to.toISOString(), platform],
    queryFn: async () => {
      let q = supabase
        .from("sv_platform_posts")
        .select("*", { count: "exact", head: true })
        .in("connected_account_id", scope.accountIds)
        .gte("posted_at", range.from.toISOString())
        .lte("posted_at", range.to.toISOString());
      if (platform) q = q.eq("platform", platform);

      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
    enabled: Boolean(user?.id) && scope.ready,
  });
}

export function useTopPosts(range: DateRange, limit = 10) {
  const { user } = useAuth();
  const scope = useBrandScope();

  return useQuery({
    queryKey: ["top-posts", user?.id, scope.brandId, scope.accountIds, range.from.toISOString(), range.to.toISOString(), limit],
    queryFn: async () => {
      let q = supabase
        .from("sv_posts")
        .select("*, sv_post_platform_results(*)")
        .eq("status", "published")
        .gte("published_at", range.from.toISOString())
        .lte("published_at", range.to.toISOString())
        .order("published_at", { ascending: false })
        .limit(50);
      const filter = postBrandFilter(scope.brandId, scope.accountIds);
      if (filter) q = q.or(filter);
      const { data, error } = await q;
      if (error) throw error;

      return [...data]
        .map((post) => {
          const results = post.sv_post_platform_results.filter((result) => result.connected_account_id !== null && scope.accountIds.includes(result.connected_account_id));
          const engagement = results.reduce((sum: number, r) => {
            const data = r.engagement_data as Record<string, number> | null;
            return sum + (data?.likes ?? 0) + (data?.comments ?? 0) + (data?.shares ?? 0);
          }, 0);
          return { post: { ...post, sv_post_platform_results: results }, engagement };
        })
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, limit);
    },
    enabled: Boolean(user?.id) && scope.ready,
  });
}
