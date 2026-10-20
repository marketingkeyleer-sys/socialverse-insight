import { Eye, ExternalLink, FileText, Heart, Images, MessageCircle, PlayCircle, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getPlatformColor, getPlatformIcon, getPlatformLabel } from "@/lib/platforms";
import { formatDate, formatNumber, getRelativeTime } from "@/lib/utils";
import type { Platform, PlatformPost } from "@/types/database";

const TYPE_META: Record<string, { label: string; icon: typeof FileText }> = {
  image: { label: "Image", icon: Images },
  video: { label: "Video", icon: PlayCircle },
  carousel: { label: "Carousel", icon: Images },
  text: { label: "Text", icon: FileText },
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-center">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function PostDetailDialog({
  post,
  open,
  onOpenChange,
}: {
  post: PlatformPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!post) return null;

  const Icon = getPlatformIcon(post.platform as Platform);
  const color = getPlatformColor(post.platform as Platform);
  const typeMeta = post.media_type ? TYPE_META[post.media_type] : undefined;
  const totalEngagement = post.likes_count + post.comments_count + post.shares_count;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5" style={{ color }}>
              <Icon className="h-4 w-4" /> {getPlatformLabel(post.platform as Platform)}
            </span>
            {typeMeta && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <typeMeta.icon className="h-3 w-3" /> {typeMeta.label}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {post.media_url && (
            <div className="relative overflow-hidden rounded-lg bg-muted">
              <img src={post.media_url} alt="" className="max-h-72 w-full object-cover" />
              {post.media_type === "video" && (
                <span className="absolute inset-0 grid place-items-center bg-black/30">
                  <PlayCircle className="h-10 w-10 text-white" />
                </span>
              )}
            </div>
          )}

          <p className="whitespace-pre-wrap text-sm">{post.message ?? "(no caption)"}</p>

          <p className="text-xs text-muted-foreground">
            Posted {formatDate(post.posted_at, { hour: "numeric", minute: "2-digit" })} ({getRelativeTime(post.posted_at)})
          </p>

          <div className="grid grid-cols-3 gap-2">
            <Metric label="Likes" value={formatNumber(post.likes_count)} />
            <Metric label="Comments" value={formatNumber(post.comments_count)} />
            <Metric label="Shares" value={formatNumber(post.shares_count)} />
            {post.reach !== null && <Metric label="Reach" value={formatNumber(post.reach)} />}
            {post.impressions !== null && <Metric label="Impressions" value={formatNumber(post.impressions)} />}
            {post.views_count !== null && <Metric label="Views" value={formatNumber(post.views_count)} />}
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <p className="text-xs text-muted-foreground">
              <Heart className="mr-1 inline h-3 w-3" />
              <MessageCircle className="mr-1 inline h-3 w-3" />
              <Share2 className="mr-1 inline h-3 w-3" />
              {formatNumber(totalEngagement)} total engagement
            </p>
            {post.permalink_url && (
              <Button asChild size="sm" variant="outline">
                <a href={post.permalink_url} target="_blank" rel="noreferrer">
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> View live
                  <ExternalLink className="ml-1.5 h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
