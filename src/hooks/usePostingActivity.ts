import { useBrandScope } from "@/contexts/BrandContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { DateRange } from "@/hooks/useAnalytics";
import type { Platform, PlatformPost } from "@/types/database";

export interface PostingActivityDay {
  date: string;
  facebook: number;
  instagram: number;
  youtube: number;
  linkedin: number;
  linkedin_page: number;
  // No WhatsApp posts are ever synced into sv_platform_posts (broadcasts have
  // their own table), so this is always 0 — it exists to keep the row keyed
  // by every Platform.
  whatsapp: number;
  total: number;
}

// Backs the dashboard's posting-activity chart and its click-through day
// view — one fetch of the raw rows in range, since both the per-day counts
// and the "show me that day's posts" list are just different groupings of
// the same data.
export function usePostingActivity(range: DateRange) {
  const { user } = useAuth();
  const scope = useBrandScope();

  return useQuery({
    queryKey: ["posting-activity", user?.id, scope.brandId, scope.accountIds, range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sv_platform_posts")
        .select("*")
        .in("connected_account_id", scope.accountIds)
        .gte("posted_at", range.from.toISOString())
        .lte("posted_at", range.to.toISOString())
        .order("posted_at", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return data;
    },
    enabled: Boolean(user?.id) && scope.ready,
  });
}

export function buildActivityChartData(posts: PlatformPost[]): PostingActivityDay[] {
  const byDate = new Map<string, PostingActivityDay>();
  for (const post of posts) {
    const date = post.posted_at.slice(0, 10);
    const row = byDate.get(date) ?? { date, facebook: 0, instagram: 0, youtube: 0, linkedin: 0, linkedin_page: 0, whatsapp: 0, total: 0 };
    row[post.platform as Platform] += 1;
    row.total += 1;
    byDate.set(date, row);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function groupPostsByDate(posts: PlatformPost[]): Map<string, PlatformPost[]> {
  const byDate = new Map<string, PlatformPost[]>();
  for (const post of posts) {
    const date = post.posted_at.slice(0, 10);
    byDate.set(date, [...(byDate.get(date) ?? []), post]);
  }
  return byDate;
}
