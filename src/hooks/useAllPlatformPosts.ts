import { useBrandScope } from "@/contexts/BrandContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Platform, PlatformPost } from "@/types/database";
import type { ReportRange } from "@/lib/analyticsReport";

export type AllPlatformPost = PlatformPost & { publishedViaSocialVerse: boolean };

// Every real post pulled in from a connected platform, across every account
// — the full "what's actually on my pages" list, distinct from sv_posts
// (what was composed inside SocialVerse). Source tagging works the same way
// as usePlatformPosts, just joined across accounts instead of scoped to one.
export function useAllPlatformPosts(platform?: Platform, range?: ReportRange) {
  const { user } = useAuth();
  const scope = useBrandScope();

  return useQuery<AllPlatformPost[]>({
    queryKey: ["all-platform-posts", user?.id, scope.brandId, scope.accountIds, platform, range?.from.toISOString(), range?.to.toISOString()],
    queryFn: async () => {
      if (!scope.accountIds.length) return [];
      const loadPosts = async () => {
        const rows: PlatformPost[] = [];
        for (let offset = 0;; offset += 500) {
          let q = supabase.from("sv_platform_posts").select("*").in("connected_account_id", scope.accountIds).order("posted_at", { ascending: false }).order("id").range(offset, offset + 499);
          if (platform) q = q.eq("platform", platform);
          if (range) q = q.gte("posted_at", range.from.toISOString()).lte("posted_at", range.to.toISOString());
          const {data, error} = await q;
          if (error) throw error;
          rows.push(...data);
          if (data.length < 500) break;
        }
        return {data: rows, error: null};
      };

      const [postsRes, resultsRes] = await Promise.all([
        loadPosts(),
        supabase
          .from("sv_post_platform_results")
          .select("connected_account_id, platform_post_id")
          .in("connected_account_id", scope.accountIds)
          .eq("status", "published")
          .not("platform_post_id", "is", null),
      ]);
      if (postsRes.error) throw postsRes.error;
      if (resultsRes.error) throw resultsRes.error;

      const viaSocialVerse = new Set(
        resultsRes.data.map((r) => `${r.connected_account_id}:${r.platform_post_id}`),
      );
      return postsRes.data.map((post) => ({
        ...post,
        publishedViaSocialVerse: viaSocialVerse.has(`${post.connected_account_id}:${post.platform_post_id}`),
      }));
    },
    enabled: Boolean(user?.id) && scope.ready,
  });
}
