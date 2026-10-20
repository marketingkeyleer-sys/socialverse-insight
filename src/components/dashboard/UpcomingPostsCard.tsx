import { Link } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformIcon, getPlatformLabel } from "@/lib/platforms";
import { formatDate, truncateText } from "@/lib/utils";
import type { Platform, Post } from "@/types/database";

export function UpcomingPostsCard({ posts }: { posts: Post[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" /> Upcoming
        </CardTitle>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nothing scheduled —{" "}
            <Link to="/calendar" className="font-medium text-primary hover:underline">
              plan one on the calendar
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-3">
            {posts.map((post) => (
              <li key={post.id}>
                <Link to={`/posts/${post.id}`} className="flex items-start gap-2.5 rounded-lg hover:bg-accent -mx-2 px-2 py-1">
                  <div className="flex -space-x-1.5 pt-0.5">
                    {post.platforms.map((p) => {
                      const Icon = getPlatformIcon(p as Platform);
                      return (
                        <span key={p} className="grid h-5 w-5 place-items-center rounded-full bg-muted ring-2 ring-card" title={getPlatformLabel(p as Platform)}>
                          <Icon className="h-3 w-3" />
                        </span>
                      );
                    })}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{post.title || truncateText(post.content, 40)}</p>
                    <p className="text-xs text-muted-foreground">{post.scheduled_at && formatDate(post.scheduled_at, { hour: "numeric", minute: "2-digit" })}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
