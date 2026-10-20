import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

// Nothing on the dashboard currently shows what's coming up — you'd have to
// go to /calendar or /posts and filter by "scheduled" to find out.
export function useUpcomingPosts(limit = 5) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["upcoming-posts", user?.id, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sv_posts")
        .select("*")
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return data;
    },
    enabled: Boolean(user?.id),
  });
}
