import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PostStatusBadge } from "@/components/posts/PostStatusBadge";
import { getPlatformLabel } from "@/lib/platforms";
import { getRelativeTime, truncateText } from "@/lib/utils";
import type { Platform, Post } from "@/types/database";

export function RecentPosts({ posts }: { posts: Post[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent posts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {posts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No posts published yet.</p>
        ) : (
          posts.map((post) => (
            <Link
              key={post.id}
              to={`/posts/${post.id}`}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-accent"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{truncateText(post.content, 70)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {post.platforms.map((p) => (
                    <Badge key={p} variant="secondary" className="text-[10px]">
                      {getPlatformLabel(p as Platform)}
                    </Badge>
                  ))}
                  <span className="text-xs text-muted-foreground">
                    {post.published_at ? getRelativeTime(post.published_at) : ""}
                  </span>
                </div>
              </div>
              <PostStatusBadge status={post.status} />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
