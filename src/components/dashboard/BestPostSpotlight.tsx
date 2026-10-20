import { ExternalLink, Heart, MessageCircle, Share2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformColor, getPlatformIcon, getPlatformLabel } from "@/lib/platforms";
import { formatNumber, getRelativeTime } from "@/lib/utils";
import type { Platform, PlatformPost } from "@/types/database";

export function BestPostSpotlight({
  post,
  onSelect,
}: {
  post: PlatformPost | null | undefined;
  onSelect?: (post: PlatformPost) => void;
}) {
  if (!post) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-amber-500" /> Best post
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-4 text-center text-sm text-muted-foreground">No synced posts in this period yet.</p>
        </CardContent>
      </Card>
    );
  }

  const Icon = getPlatformIcon(post.platform as Platform);
  const color = getPlatformColor(post.platform as Platform);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-amber-500" /> Best post
        </CardTitle>
      </CardHeader>
      <CardContent>
        <button
          onClick={() => onSelect?.(post)}
          className="flex w-full gap-3 rounded-lg -mx-2 px-2 py-1 text-left hover:bg-accent"
        >
          {post.media_url && (
            <img src={post.media_url} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="line-clamp-2 text-sm">{post.message ?? "(no caption)"}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1" style={{ color }}>
                <Icon className="h-3 w-3" /> {getPlatformLabel(post.platform as Platform)}
              </span>
              <span>{getRelativeTime(post.posted_at)}</span>
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3 w-3" /> {formatNumber(post.likes_count)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-3 w-3" /> {formatNumber(post.comments_count)}
              </span>
              {post.shares_count > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Share2 className="h-3 w-3" /> {formatNumber(post.shares_count)}
                </span>
              )}
              {post.permalink_url && <ExternalLink className="ml-auto h-3 w-3" />}
            </div>
          </div>
        </button>
      </CardContent>
    </Card>
  );
}
