import { useBrandScope } from "@/contexts/BrandContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { DateRange } from "@/hooks/useAnalytics";

// The single real post (from any connected platform, not just ones composed
// in SocialVerse) with the most combined engagement in the window — a
// concrete "this is what's working" answer, not just totals.
export function useBestPost(range: DateRange) {
  const { user } = useAuth();
  const scope = useBrandScope();

  return useQuery({
    queryKey: ["best-post", user?.id, scope.brandId, scope.accountIds, range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sv_platform_posts")
        .select("*")
        .in("connected_account_id", scope.accountIds)
        .gte("posted_at", range.from.toISOString())
        .lte("posted_at", range.to.toISOString())
        .limit(2000);
      if (error) throw error;
      if (data.length === 0) return null;

      return data.reduce((best, post) => {
        const score = post.likes_count + post.comments_count + post.shares_count;
        const bestScore = best.likes_count + best.comments_count + best.shares_count;
        return score > bestScore ? post : best;
      }, data[0]);
    },
    enabled: Boolean(user?.id) && scope.ready,
  });
}
