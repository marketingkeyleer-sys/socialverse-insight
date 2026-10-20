import { useState } from "react";
import { Download, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/analytics/DateRangePicker";
import { MetricCard } from "@/components/analytics/MetricCard";
import { FollowersTrendChart } from "@/components/analytics/FollowersTrendChart";
import { ReachImpressionsChart } from "@/components/analytics/ReachImpressionsChart";
import { EngagementChart } from "@/components/analytics/EngagementChart";
import { PostsBarChart } from "@/components/analytics/PostsBarChart";
import { PlatformDonut } from "@/components/analytics/PlatformDonut";
import { TopPostsTable } from "@/components/analytics/TopPostsTable";
import { PlatformPostsTable } from "@/components/analytics/PlatformPostsTable";
import { UnconnectedPlatforms } from "@/components/dashboard/UnconnectedPlatforms";
import { useAnalytics, useTopPosts, last } from "@/hooks/useAnalytics";
import { useAllPlatformPosts } from "@/hooks/useAllPlatformPosts";
import { useScopedAccounts as useConnectedAccounts, useBrandScope } from "@/contexts/BrandContext";
import { usePosts } from "@/hooks/usePosts";
import { PLATFORM_CONFIGS } from "@/lib/platforms";
import { cn, formatNumber } from "@/lib/utils";
import type { Platform } from "@/types/database";

export default function Analytics() {
  const scope = useBrandScope();
  const [range, setRange] = useState(last(30));
  const [activeDays, setActiveDays] = useState<number | null>(30);
  const [platform, setPlatform] = useState<Platform | undefined>(undefined);

  const { data: snapshots = [], aggregates, isLoading } = useAnalytics(range, platform);
  const { data: accounts = [] } = useConnectedAccounts();
  const { data: topPosts = [] } = useTopPosts(range);
  const { list } = usePosts({ status: "published" });
  // Unfiltered — the table has its own platform filter now, independent of
  // the page-level one above (which still governs the stat cards/charts).
  const { data: platformPosts = [] } = useAllPlatformPosts();

  const sparklineFor = (field: "followers" | "impressions" | "reach") => {
    const byDate = new Map<string, number>();
    for (const s of snapshots) byDate.set(s.metric_date, (byDate.get(s.metric_date) ?? 0) + s[field]);
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  };

  const filteredAccounts = platform ? accounts.filter((a) => a.platform === platform) : accounts;

  const handleExport = () => {
    const header = "date,platform,account_id,followers,impressions,reach,engagement_rate\n";
    const rows = snapshots
      .map((s) => `${s.metric_date},${s.platform},${s.connected_account_id},${s.followers},${s.impressions},${s.reach},${s.engagement_rate}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "socialhub-analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs uppercase tracking-widest text-primary">{scope.brandName}</p><h1 className="text-2xl font-semibold tracking-tight">Brand performance</h1><p className="mt-1 text-sm text-muted-foreground">Real results from this workspace's channels. Platform audiences are counted separately.</p></div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <UnconnectedPlatforms accounts={accounts} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker range={range} activeDays={activeDays} onChange={(r, d) => { setRange(r); setActiveDays(d); }} />
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setPlatform(undefined)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              !platform ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            All
          </button>
          {PLATFORM_CONFIGS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                platform === p.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Followers" value={formatNumber(aggregates.totalFollowers)} changePct={aggregates.followersChangePct} sparkline={sparklineFor("followers")} />
          <MetricCard label="Impressions" value={formatNumber(aggregates.totalImpressions)} changePct={aggregates.impressionsChangePct} sparkline={sparklineFor("impressions")} />
          <MetricCard label="Engagement rate" value={`${aggregates.avgEngagementRate.toFixed(1)}%`} sparkline={[]} />
          <MetricCard label="Reach" value={formatNumber(aggregates.totalReach)} sparkline={sparklineFor("reach")} />
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <FollowersTrendChart snapshots={snapshots} />
      )}

      {isLoading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <ReachImpressionsChart snapshots={snapshots} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {isLoading ? <Skeleton className="h-64 rounded-xl" /> : <EngagementChart snapshots={snapshots} />}
        {isLoading ? <Skeleton className="h-64 rounded-xl" /> : <PostsBarChart posts={list.data?.posts ?? []} />}
      </div>

      {!isLoading && (
        <div className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">What's real vs. still limited, per platform</p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5">
            <li><span className="text-foreground">Facebook</span> — up to 2 years of real daily history.</li>
            <li><span className="text-foreground">Instagram / YouTube</span> — real data, but only from today onward (each sync since adds one more day; historical backfill isn't available from these APIs the way Facebook's is).</li>
            <li><span className="text-foreground">LinkedIn</span> — connected for identity only right now. Posting/analytics access needs LinkedIn's Community Management API, which is a separate approval still pending on their side.</li>
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <PlatformDonut accounts={filteredAccounts} />
        <TopPostsTable
          rows={topPosts.map((r) => ({
            post: r.post as typeof r.post & { sv_post_platform_results: NonNullable<typeof r.post.sv_post_platform_results> },
            engagement: r.engagement,
          }))}
        />
      </div>

      <PlatformPostsTable posts={platformPosts} />

      {aggregates.totalFollowers === 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" /> Not enough data yet — check back once your accounts have some history.
        </p>
      )}
    </div>
  );
}
