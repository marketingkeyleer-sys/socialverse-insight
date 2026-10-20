import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PlatformPost, PostPlatformResult } from "@/types/database";
import { useBrandScope } from "@/contexts/BrandContext";

// A published sv_post_platform_results row only records the outcome of the
// publish call itself (succeeded/failed, the real platform_post_id) — the
// actual engagement/reach/impressions numbers only exist once sync-account
// has pulled that same post back in as a sv_platform_posts row. Joins them
// by platform_post_id so the post detail page can show real numbers instead
// of the always-empty engagement_data column.
export function usePostResultAnalytics(results: PostPlatformResult[] | undefined) {
  const scope = useBrandScope();
  const publishedIds = (results ?? [])
    .filter((r) => r.status === "published" && r.platform_post_id)
    .map((r) => r.platform_post_id as string);

  return useQuery<Map<string, PlatformPost>>({
    queryKey: ["post-result-analytics", scope.brandId, scope.accountIds, publishedIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sv_platform_posts")
        .select("*")
        .in("connected_account_id", scope.accountIds)
        .in("platform_post_id", publishedIds);
      if (error) throw error;
      return new Map(data.map((p) => [`${p.connected_account_id}:${p.platform_post_id}`, p]));
    },
    enabled: publishedIds.length > 0,
  });
}
