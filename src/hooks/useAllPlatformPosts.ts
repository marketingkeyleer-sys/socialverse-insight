import { useBrandScope } from "@/contexts/BrandContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Platform, PlatformPost } from "@/types/database";

export type AllPlatformPost = PlatformPost & { publishedViaSocialVerse: boolean };

// Every real post pulled in from a connected platform, across every account
// — the full "what's actually on my pages" list, distinct from sv_posts
// (what was composed inside SocialVerse). Source tagging works the same way
// as usePlatformPosts, just joined across accounts instead of scoped to one.
export function useAllPlatformPosts(platform?: Platform) {
  const { user } = useAuth();
  const scope = useBrandScope();

  return useQuery<AllPlatformPost[]>({
    queryKey: ["all-platform-posts", user?.id, scope.brandId, scope.accountIds, platform],
    queryFn: async () => {
      let postsQuery = supabase.from("sv_platform_posts").select("*").in("connected_account_id", scope.accountIds).order("posted_at", { ascending: false });
      if (platform) postsQuery = postsQuery.eq("platform", platform);

      const [postsRes, resultsRes] = await Promise.all([
        postsQuery,
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
