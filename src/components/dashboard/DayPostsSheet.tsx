import { FileText, Images, PlayCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getPlatformColor, getPlatformIcon, getPlatformLabel } from "@/lib/platforms";
import { formatDate, formatNumber, truncateText } from "@/lib/utils";
import type { Platform, PlatformPost } from "@/types/database";

const TYPE_ICON: Record<string, typeof FileText> = {
  image: Images,
  video: PlayCircle,
  carousel: Images,
};

export function DayPostsSheet({
  date,
  posts,
  onOpenChange,
  onSelectPost,
}: {
  date: string | null;
  posts: PlatformPost[];
  onOpenChange: (open: boolean) => void;
  onSelectPost: (post: PlatformPost) => void;
}) {
  return (
    <Sheet open={date !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{date ? formatDate(date) : ""}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {posts.length} {posts.length === 1 ? "post" : "posts"} that day
          </p>
        </SheetHeader>
        <div className="space-y-1 overflow-y-auto px-4 pb-4">
          {posts.map((post) => {
            const Icon = getPlatformIcon(post.platform as Platform);
            const color = getPlatformColor(post.platform as Platform);
            const TypeIcon = post.media_type ? TYPE_ICON[post.media_type] : undefined;
            return (
              <button
                key={post.id}
                onClick={() => onSelectPost(post)}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-accent"
              >
                <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                  {post.media_url ? (
                    <img src={post.media_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                  {TypeIcon && post.media_type === "video" && (
                    <span className="absolute inset-0 grid place-items-center bg-black/30">
                      <TypeIcon className="h-4 w-4 text-white" />
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm">{truncateText(post.message ?? "(no caption)", 48)}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1" style={{ color }}>
                      <Icon className="h-3 w-3" /> {getPlatformLabel(post.platform as Platform)}
                    </span>
                    <span>{formatNumber(post.likes_count)} likes</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
