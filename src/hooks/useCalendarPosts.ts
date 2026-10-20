import { useBrandScope } from "@/contexts/BrandContext";
import { postBrandFilter } from "@/lib/brandScope";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Post } from "@/types/database";

// A calendar shows dated content — drafts with neither a scheduled_at nor a
// published_at have no date to anchor to, so they're excluded here (they
// still show up in the regular Posts list).
export function useCalendarPosts() {
  const { user } = useAuth();
  const scope = useBrandScope();

  return useQuery({
    queryKey: ["calendar-posts", user?.id, scope.brandId, scope.accountIds],
    queryFn: async () => {
      let q = supabase
        .from("sv_posts")
        .select("*")
        .neq("status", "draft")
        .order("scheduled_at", { ascending: true })
        .limit(500);
      const filter = postBrandFilter(scope.brandId, scope.accountIds);
      if (filter) q = q.or(filter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: Boolean(user?.id) && scope.ready,
  });
}

export function effectiveDate(post: Post): string | null {
  return post.scheduled_at ?? post.published_at ?? null;
}
