import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PostStatusBadge } from "@/components/posts/PostStatusBadge";
import { usePost, usePosts } from "@/hooks/usePosts";
import { usePostResultAnalytics } from "@/hooks/usePostResultAnalytics";
import { getPlatformLabel } from "@/lib/platforms";
import { formatDate, formatNumber } from "@/lib/utils";
import type { Platform } from "@/types/database";

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: post, isLoading } = usePost(id);
  const { deletePost, retryPost } = usePosts();
  const { data: liveAnalytics } = usePostResultAnalytics(post?.sv_post_platform_results);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!post) {
    return <div className="p-6 text-center text-muted-foreground">Post not found.</div>;
  }

  const handleDelete = async () => {
    await deletePost.mutateAsync(post.id);
    navigate("/posts");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/posts">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to posts
        </Link>
      </Button>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{post.title || "Untitled post"}</CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {post.platforms.map((p) => (
                <Badge key={p} variant="secondary" className="text-[10px]">
                  {getPlatformLabel(p as Platform)}
                </Badge>
              ))}
              <PostStatusBadge status={post.status} />
              <span className="text-xs text-muted-foreground">
                {formatDate(post.published_at ?? post.scheduled_at ?? post.created_at)}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {(post.status === "failed" || post.status === "partially_failed") && (
              <Button size="sm" variant="outline" disabled={retryPost.isPending || post.sv_post_platform_results.some((r) => r.error_message?.startsWith("Outcome unknown"))}
                onClick={() => retryPost.mutate(post.id)}>{retryPost.isPending ? "Retrying…" : "Retry failed destinations"}</Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link to={`/compose?id=${post.id}`}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                  <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm">{post.content}</p>
          {post.media_urls && post.media_urls.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {post.media_urls.map((url) =>
                /\.(mp4|mov)$/i.test(url) ? (
                  <video key={url} src={url} controls className="aspect-video w-full rounded-lg object-cover" />
                ) : (
                  <img key={url} src={url} alt="" className="aspect-video w-full rounded-lg object-cover" />
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {liveAnalytics && liveAnalytics.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance across every platform</CardTitle>
            <p className="text-xs text-muted-foreground">
              Real numbers as of this post's last sync — click "Sync now" on the relevant account in Accounts to
              refresh them.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {(() => {
                const rows = [...liveAnalytics.values()];
                const sum = (key: "likes_count" | "comments_count" | "shares_count") =>
                  rows.reduce((s, r) => s + r[key], 0);
                const sumNullable = (key: "reach" | "impressions" | "views_count") => {
                  const vals = rows.map((r) => r[key]).filter((v): v is number => v !== null);
                  return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) : null;
                };
                const stats: { label: string; value: number | null }[] = [
                  { label: "Likes", value: sum("likes_count") },
                  { label: "Comments", value: sum("comments_count") },
                  { label: "Shares", value: sum("shares_count") },
                  { label: "Reach", value: sumNullable("reach") },
                  { label: "Impressions", value: sumNullable("impressions") },
                  { label: "Views", value: sumNullable("views_count") },
                ];
                return stats.map((s) => (
                  <div key={s.label}>
                    <p className="text-lg font-semibold">{s.value !== null ? formatNumber(s.value) : "—"}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ));
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-platform results</CardTitle>
        </CardHeader>
        <CardContent>
          {post.sv_post_platform_results.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No publish attempts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead>Engagement</TableHead>
                    <TableHead className="text-right">Reach</TableHead>
                    <TableHead className="text-right">Impressions</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {post.sv_post_platform_results.map((result) => {
                    const live = result.platform_post_id ? liveAnalytics?.get(result.platform_post_id) : undefined;
                    return (
                      <TableRow key={result.id}>
                        <TableCell>{getPlatformLabel(result.platform as Platform)}</TableCell>
                        <TableCell>
                          <Badge variant={result.status === "failed" ? "destructive" : "secondary"}>{result.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {result.published_url ? (
                            <a href={result.published_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {live
                            ? `${formatNumber(live.likes_count)} likes · ${formatNumber(live.comments_count)} comments · ${formatNumber(live.shares_count)} shares`
                            : result.status === "published"
                              ? "Not synced yet"
                              : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {live?.reach !== undefined && live?.reach !== null ? formatNumber(live.reach) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {live?.impressions !== undefined && live?.impressions !== null ? formatNumber(live.impressions) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {live?.views_count !== undefined && live?.views_count !== null ? formatNumber(live.views_count) : "—"}
                        </TableCell>
                        <TableCell className="max-w-48 truncate text-destructive">{result.error_message ?? ""}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
