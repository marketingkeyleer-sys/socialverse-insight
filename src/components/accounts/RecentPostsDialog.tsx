import { ExternalLink, Heart, MessageCircle, Share2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlatformPosts } from "@/hooks/usePlatformPosts";
import { formatNumber, getRelativeTime, truncateText } from "@/lib/utils";
import { getPlatformLabel } from "@/lib/platforms";
import type { ConnectedAccount, Platform } from "@/types/database";

export function RecentPostsDialog({
  account,
  open,
  onOpenChange,
}: {
  account: ConnectedAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: posts = [], isLoading } = usePlatformPosts(open ? account.id : undefined);
  const platform = account.platform as Platform;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recent {getPlatformLabel(platform)} posts</DialogTitle>
          <DialogDescription>Pulled from @{account.platform_username} on your last sync.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No posts synced yet. Click "Sync now" on this account to pull recent posts.
          </p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <a
                key={post.id}
                href={post.permalink_url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="flex gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                {post.media_url && (
                  <img src={post.media_url} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="line-clamp-2 flex-1 text-sm">{truncateText(post.message ?? "(no caption)", 140)}</p>
                    {post.publishedViaSocialVerse && (
                      <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                        <Sparkles className="h-3 w-3" /> Via SocialVerse
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{getRelativeTime(post.posted_at)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3 w-3" /> {formatNumber(post.likes_count)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" /> {formatNumber(post.comments_count)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Share2 className="h-3 w-3" /> {formatNumber(post.shares_count)}
                    </span>
                    {post.permalink_url && <ExternalLink className="ml-auto h-3 w-3" />}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
