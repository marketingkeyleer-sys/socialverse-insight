import { useBrandScope } from "@/contexts/BrandContext";
import { postBrandFilter } from "@/lib/brandScope";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Post } from "@/types/database";

// A calendar shows dated content — drafts with neither a scheduled_at nor a
// published_at have no date to anchor to, so they're excluded here (they
// still show up in the regular Posts list).
export function useCalendarPosts(month: Date) {
  const { user } = useAuth();
  const scope = useBrandScope();
  const from = new Date(month.getFullYear(), month.getMonth(), 1);
  from.setDate(from.getDate() - from.getDay());
  const to = new Date(from); to.setDate(to.getDate() + 42);

  return useQuery({
    queryKey: ["calendar-posts", user?.id, scope.brandId, scope.accountIds, from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const rows: Post[] = [];
      for (let offset = 0;; offset += 500) {
      let q = supabase
        .from("sv_posts")
        .select("*")
        .neq("status", "draft")
        .order("scheduled_at", { ascending: true })
        .order("id")
        .range(offset, offset + 499);
      const filter = postBrandFilter(scope.brandId, scope.accountIds);
      const dates = `and(scheduled_at.gte.${from.toISOString()},scheduled_at.lt.${to.toISOString()}),and(published_at.gte.${from.toISOString()},published_at.lt.${to.toISOString()})`;
      q = q.or(filter ? `and(or(${filter}),or(${dates}))` : dates);
      const { data, error } = await q;
      if (error) throw error;
      rows.push(...data);
      if (data.length < 500) return rows;
      }
    },
    enabled: Boolean(user?.id) && scope.ready,
    staleTime: 0,
    refetchInterval: 30_000,
  });
}

export function effectiveDate(post: Post): string | null {
  return post.scheduled_at ?? post.published_at ?? null;
}
