import { useMemo, useState } from "react";
import { ArrowUpDown, ExternalLink, FileText, Images, PlayCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPlatformIcon, getPlatformLabel } from "@/lib/platforms";
import { cn, formatDate, formatNumber, truncateText } from "@/lib/utils";
import type { AllPlatformPost } from "@/hooks/useAllPlatformPosts";
import type { Platform } from "@/types/database";

type SortKey = "date" | "platform" | "likes" | "comments";

const TYPE_META: Record<string, { label: string; icon: typeof FileText }> = {
  image: { label: "Image", icon: Images },
  video: { label: "Video", icon: PlayCircle },
  carousel: { label: "Carousel", icon: Images },
  text: { label: "Text", icon: FileText },
};

function PostThumbnail({ post }: { post: AllPlatformPost }) {
  const meta = post.media_type ? TYPE_META[post.media_type] : undefined;
  const TypeIcon = meta?.icon ?? FileText;

  if (!post.media_url) {
    return (
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-dashed text-muted-foreground">
        <FileText className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
      <img src={post.media_url} alt="" className="h-full w-full object-cover" />
      {post.media_type === "video" && (
        <span className="absolute inset-0 grid place-items-center bg-black/30">
          <TypeIcon className="h-5 w-5 text-white" />
        </span>
      )}
    </span>
  );
}

function SortableHead({
  label,
  active,
  direction,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 font-medium hover:text-foreground ${active ? "text-foreground" : ""}`}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active && direction === "asc" ? "rotate-180" : ""}`} />
      </button>
    </TableHead>
  );
}

export function PlatformPostsTable({ posts }: { posts: AllPlatformPost[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [platformFilter, setPlatformFilter] = useState<Platform | null>(null);

  const availablePlatforms = useMemo(
    () => [...new Set(posts.map((p) => p.platform as Platform))],
    [posts],
  );

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    const filtered = platformFilter ? posts.filter((p) => p.platform === platformFilter) : posts;
    const factor = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "platform":
          return factor * a.platform.localeCompare(b.platform);
        case "likes":
          return factor * (a.likes_count - b.likes_count);
        case "comments":
          return factor * (a.comments_count - b.comments_count);
        default:
          return factor * (new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime());
      }
    });
  }, [posts, platformFilter, sortKey, sortDir]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">All posts</CardTitle>
          {availablePlatforms.length > 1 && (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setPlatformFilter(null)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  !platformFilter ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                All
              </button>
              {availablePlatforms.map((p) => {
                const Icon = getPlatformIcon(p);
                return (
                  <button
                    key={p}
                    onClick={() => setPlatformFilter(p)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      platformFilter === p ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                    )}
                  >
                    <Icon className="h-3 w-3" /> {getPlatformLabel(p)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Every real post on your connected accounts — from your last sync. Click a column header to sort by
          date or platform. Views are YouTube's reach equivalent; follower growth is a page-wide trend, shown
          above instead. Facebook doesn't currently expose per-post reach/impressions or likes/comments to
          apps like this one — see <a href="/settings" className="underline">Settings → Activity</a> for why.
          Instagram reach/impressions need a permission (instagram_manage_insights) this account hasn't
          granted yet.
        </p>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No posts synced yet — click "Sync now" on a connected account to pull them in.
          </p>
        ) : sorted.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No posts for this platform yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Date" active={sortKey === "date"} direction={sortDir} onClick={() => toggleSort("date")} />
                  <TableHead>Post</TableHead>
                  <TableHead>Type</TableHead>
                  <SortableHead label="Platform" active={sortKey === "platform"} direction={sortDir} onClick={() => toggleSort("platform")} />
                  <TableHead>Source</TableHead>
                  <SortableHead label="Likes" active={sortKey === "likes"} direction={sortDir} onClick={() => toggleSort("likes")} align="right" />
                  <SortableHead label="Comments" active={sortKey === "comments"} direction={sortDir} onClick={() => toggleSort("comments")} align="right" />
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Reach</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((post) => {
                  const Icon = getPlatformIcon(post.platform as Platform);
                  const typeMeta = post.media_type ? TYPE_META[post.media_type] : undefined;
                  return (
                    <TableRow key={post.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(post.posted_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <PostThumbnail post={post} />
                          <span className="max-w-56 truncate">{truncateText(post.message ?? "(no caption)", 60)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {typeMeta ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <typeMeta.icon className="h-3.5 w-3.5" /> {typeMeta.label}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Icon className="h-3.5 w-3.5" /> {getPlatformLabel(post.platform as Platform)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {post.publishedViaSocialVerse ? (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <Sparkles className="h-3 w-3" /> Via SocialVerse
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Posted directly</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(post.likes_count)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(post.comments_count)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(post.shares_count)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {post.reach !== null ? formatNumber(post.reach) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {post.impressions !== null ? formatNumber(post.impressions) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {post.views_count !== null ? formatNumber(post.views_count) : "—"}
                      </TableCell>
                      <TableCell>
                        {post.permalink_url && (
                          <a href={post.permalink_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
