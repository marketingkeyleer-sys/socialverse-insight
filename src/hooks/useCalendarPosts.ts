import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Post } from "@/types/database";

// A calendar shows dated content — drafts with neither a scheduled_at nor a
// published_at have no date to anchor to, so they're excluded here (they
// still show up in the regular Posts list).
export function useCalendarPosts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["calendar-posts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sv_posts")
        .select("*")
        .neq("status", "draft")
        .order("scheduled_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: Boolean(user?.id),
  });
}

export function effectiveDate(post: Post): string | null {
  return post.scheduled_at ?? post.published_at ?? null;
}
