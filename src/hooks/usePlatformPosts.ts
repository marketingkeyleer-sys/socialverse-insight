import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PlatformPost } from "@/types/database";

export type PlatformPostWithSource = PlatformPost & { publishedViaSocialVerse: boolean };

export function usePlatformPosts(accountId: string | undefined) {
  return useQuery<PlatformPostWithSource[]>({
    queryKey: ["platform-posts", accountId],
    queryFn: async () => {
      const [postsRes, resultsRes] = await Promise.all([
        supabase
          .from("sv_platform_posts")
          .select("*")
          .eq("connected_account_id", accountId!)
          .order("posted_at", { ascending: false }),
        // A post published through the composer shows up in both tables with
        // the same real platform_post_id once sync pulls it back in — that
        // overlap is what distinguishes "made here" from "posted directly".
        supabase
          .from("sv_post_platform_results")
          .select("platform_post_id")
          .eq("connected_account_id", accountId!)
          .eq("status", "published")
          .not("platform_post_id", "is", null),
      ]);
      if (postsRes.error) throw postsRes.error;
      if (resultsRes.error) throw resultsRes.error;

      const viaSocialVerse = new Set(resultsRes.data.map((r) => r.platform_post_id));
      return postsRes.data.map((post) => ({
        ...post,
        publishedViaSocialVerse: viaSocialVerse.has(post.platform_post_id),
      }));
    },
    enabled: Boolean(accountId),
  });
}
