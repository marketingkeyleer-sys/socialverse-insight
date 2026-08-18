import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { Brand } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { listScheduledPosts, cancelScheduledPost } from "@/lib/scheduled-posts.functions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

export const Route = createFileRoute("/scheduled-posts")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: ScheduledPostsPage,
  head: () => ({ meta: [{ title: "Scheduled posts · SocialVerse Analytics" }] }),
});

const POST_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  scheduled: "secondary",
  publishing: "secondary",
  published: "default",
  partial: "outline",
  failed: "destructive",
  canceled: "outline",
};

const TARGET_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  publishing: "secondary",
  published: "default",
  failed: "destructive",
  canceled: "outline",
};

type PostTarget = {
  id: string;
  platform: string;
  status: string;
  error_message: string | null;
  provider_post_url: string | null;
};

type ScheduledPost = {
  id: string;
  content: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  post_targets: PostTarget[];
};

function ScheduledPostsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listScheduledPosts);
  const cancel = useServerFn(cancelScheduledPost);

  const { data, isLoading } = useQuery({
    queryKey: ["scheduled-posts"],
    queryFn: () => list(),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
    },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const posts = (data?.posts ?? []) as ScheduledPost[];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Brand />
          <nav className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link to="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
            <Link to="/composer" className="hover:text-foreground">
              Composer
            </Link>
            <Link to="/connections" className="hover:text-foreground">
              Connections
            </Link>
            <button onClick={signOut} className="hover:text-foreground">
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Publishing</div>
          <h1 className="mt-2 text-3xl font-semibold">Scheduled posts</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Track every post you've composed, across every platform it targets.
          </p>
        </motion.div>

        <div className="mt-8">
          {isLoading ? (
            <div className="glass shadow-card rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : posts.length === 0 ? (
            <div className="glass shadow-card rounded-2xl p-8 text-center">
              <p className="text-sm text-muted-foreground">No posts yet.</p>
              <Link
                to="/composer"
                className="mt-4 inline-flex rounded-full bg-gradient-primary px-4 py-2 text-xs font-medium text-background shadow-glow"
              >
                Compose a post
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Content</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Platforms</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell className="max-w-xs truncate">
                        {post.content || "(no text)"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {post.scheduled_at
                          ? new Date(post.scheduled_at).toLocaleString()
                          : "Immediately"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={POST_STATUS_VARIANT[post.status] ?? "outline"}>
                          {post.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {post.post_targets.map((target) => (
                            <HoverCard key={target.id}>
                              <HoverCardTrigger asChild>
                                {target.provider_post_url ? (
                                  <a
                                    href={target.provider_post_url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <Badge
                                      variant={TARGET_STATUS_VARIANT[target.status] ?? "outline"}
                                    >
                                      {target.platform}
                                    </Badge>
                                  </a>
                                ) : (
                                  <span>
                                    <Badge
                                      variant={TARGET_STATUS_VARIANT[target.status] ?? "outline"}
                                    >
                                      {target.platform}
                                    </Badge>
                                  </span>
                                )}
                              </HoverCardTrigger>
                              <HoverCardContent className="text-xs">
                                <div className="font-medium capitalize">
                                  {target.platform} · {target.status}
                                </div>
                                {target.error_message && (
                                  <div className="mt-1 text-red-400">{target.error_message}</div>
                                )}
                              </HoverCardContent>
                            </HoverCard>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {post.status === "scheduled" && (
                          <button
                            onClick={() => cancelMut.mutate(post.id)}
                            disabled={cancelMut.isPending}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
