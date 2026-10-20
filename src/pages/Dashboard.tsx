import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Eye, Heart, PenSquare, Percent, Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/StatCard";
import { FollowersChart } from "@/components/dashboard/FollowersChart";
import { PlatformBreakdown } from "@/components/dashboard/PlatformBreakdown";
import { PlatformOverviewGrid } from "@/components/dashboard/PlatformOverviewGrid";
import { BestPerformerCard } from "@/components/dashboard/BestPerformerCard";
import { PostingActivityChart } from "@/components/dashboard/PostingActivityChart";
import { UpcomingPostsCard } from "@/components/dashboard/UpcomingPostsCard";
import { BestPostSpotlight } from "@/components/dashboard/BestPostSpotlight";
import { PostDetailDialog } from "@/components/dashboard/PostDetailDialog";
import { DayPostsSheet } from "@/components/dashboard/DayPostsSheet";
import { RecentPosts } from "@/components/dashboard/RecentPosts";
import { useAuth } from "@/hooks/useAuth";
import { useScopedAccounts as useConnectedAccounts, useBrandScope } from "@/contexts/BrandContext";
import { useAnalytics, useTotalLikes, usePostCount, last, thisMonth } from "@/hooks/useAnalytics";
import { usePosts } from "@/hooks/usePosts";
import { useUpcomingPosts } from "@/hooks/useUpcomingPosts";
import { useBestPost } from "@/hooks/useBestPost";
import { usePostingActivity, buildActivityChartData, groupPostsByDate } from "@/hooks/usePostingActivity";
import { formatNumber } from "@/lib/utils";
import type { PlatformPost } from "@/types/database";
import { BrandSummaryGrid } from "@/components/dashboard/BrandSummaryGrid";

export default function Dashboard() {
  const scope = useBrandScope();
  const { profile } = useAuth();
  const { data: accounts = [], isLoading: accountsLoading } = useConnectedAccounts();
  // A plain `const range = last(30)` re-runs `new Date()` on every render,
  // producing a new millisecond-precision timestamp each time. Since that
  // value feeds every analytics queryKey below, it made each render look
  // like a brand-new, uncached query — causing an infinite refetch loop
  // instead of ever settling into a loaded state.
  const [range] = useState(() => last(30));
  const {
    data: snapshots = [],
    aggregates,
    platformPerformance,
    isLoading: analyticsLoading,
    isError: analyticsError,
    error: analyticsErrorObj,
  } = useAnalytics(range);
  const { data: totalLikes = 0, isLoading: likesLoading, isError: likesError, error: likesErrorObj } = useTotalLikes(range);
  const [monthRange] = useState(() => thisMonth());
  const { data: postCount = 0, isLoading: postCountLoading } = usePostCount(monthRange);
  const { list } = usePosts({ status: "published" });
  const { data: upcoming = [], isLoading: upcomingLoading } = useUpcomingPosts(5);
  const { data: bestPost, isLoading: bestPostLoading } = useBestPost(range);
  const { data: activityPosts = [], isLoading: activityLoading } = usePostingActivity(range);
  const activityChartData = useMemo(() => buildActivityChartData(activityPosts), [activityPosts]);
  const postsByDate = useMemo(() => groupPostsByDate(activityPosts), [activityPosts]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<PlatformPost | null>(null);

  const isLoading = accountsLoading || analyticsLoading || likesLoading || postCountLoading;
  const metricsError = analyticsError
    ? analyticsErrorObj
    : likesError
      ? likesErrorObj
      : null;

  if (!accountsLoading && accounts.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Users className="h-8 w-8" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">{scope.brandName}: connect a social account</h1>
          <p className="mt-1 max-w-sm text-muted-foreground">
            Once you connect an account, your dashboard fills up with real analytics and post history.
          </p>
        </div>
        <Button asChild>
          <Link to="/accounts">Connect an account</Link>
        </Button>
        <BrandSummaryGrid />
      </div>
    );
  }

  const firstName = (profile?.full_name ?? profile?.email ?? "there").split(" ")[0].split("@")[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div
        className="relative overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: "linear-gradient(120deg, #103b43, #126d72)" }}
      >
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-white/70">Welcome back, {firstName}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{scope.brandName} dashboard</h1>
            <p className="mt-2 text-sm text-white/80">Your channels, your content, your results. Performance over the last 30 days.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link to="/compose">
                <PenSquare className="mr-1.5 h-4 w-4" />
                New post
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Link to="/analytics">View analytics</Link>
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-32 w-32 rounded-full bg-white/10" />
      </div>

      <BrandSummaryGrid />
      <p className="text-xs text-muted-foreground">Workspace: <strong>{scope.brandName}</strong> · {accounts.length} channels. Audience totals sum platform counts; the same person may follow more than one channel.</p>
      {accountsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <PlatformOverviewGrid accounts={accounts} />
      )}

      {metricsError && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Metrics couldn't load</p>
            <p className="mt-0.5 text-muted-foreground">
              {metricsError instanceof Error ? metricsError.message : String(metricsError)}
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="Total followers"
            value={formatNumber(accounts.reduce((sum, account) => sum + account.followers_count, 0))}
            icon={UserPlus}
            changePct={aggregates.followersChangePct}
            color="var(--chart-1)"
          />
          <StatCard label="Posts this month" value={formatNumber(postCount)} icon={PenSquare} color="var(--chart-2)" />
          <StatCard label="Avg. engagement rate" value={`${aggregates.avgEngagementRate.toFixed(1)}%`} icon={Percent} color="var(--chart-3)" />
          <StatCard
            label="Total reach"
            value={formatNumber(aggregates.totalReach)}
            icon={Eye}
            changePct={aggregates.impressionsChangePct}
            color="var(--chart-4)"
          />
          <StatCard label="Total likes" value={formatNumber(totalLikes)} icon={Heart} color="var(--chart-5)" />
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FollowersChart snapshots={snapshots} />
          </div>
          <div className="space-y-4">
            <BestPerformerCard performance={platformPerformance} />
            <PlatformBreakdown accounts={accounts} />
          </div>
        </div>
      )}

      {activityLoading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <PostingActivityChart data={activityChartData} onSelectDate={setSelectedDate} />
      )}

      {upcomingLoading || bestPostLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <UpcomingPostsCard posts={upcoming} />
          <BestPostSpotlight post={bestPost} onSelect={setSelectedPost} />
        </div>
      )}

      {list.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <RecentPosts posts={(list.data?.posts ?? []).slice(0, 5)} />
      )}

      <DayPostsSheet
        date={selectedDate}
        posts={selectedDate ? postsByDate.get(selectedDate) ?? [] : []}
        onOpenChange={(open) => !open && setSelectedDate(null)}
        onSelectPost={setSelectedPost}
      />
      <PostDetailDialog
        post={selectedPost}
        open={selectedPost !== null}
        onOpenChange={(open) => !open && setSelectedPost(null)}
      />
    </div>
  );
}
