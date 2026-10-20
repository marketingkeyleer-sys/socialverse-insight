import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPlatformLabel } from "@/lib/platforms";
import { truncateText } from "@/lib/utils";
import type { Platform, Post, PostPlatformResult } from "@/types/database";

type Row = { post: Post & { sv_post_platform_results: PostPlatformResult[] }; engagement: number };
type SortKey = "likes" | "comments" | "shares" | "engagement";

function metric(row: Row, key: SortKey): number {
  if (key === "engagement") return row.engagement;
  return row.post.sv_post_platform_results.reduce((sum, r) => {
    const data = r.engagement_data as Record<string, number> | null;
    return sum + (data?.[key] ?? 0);
  }, 0);
}

export function TopPostsTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("engagement");
  const sorted = [...rows].sort((a, b) => metric(b, sortKey) - metric(a, sortKey));

  const headers: { key: SortKey; label: string }[] = [
    { key: "likes", label: "Likes" },
    { key: "comments", label: "Comments" },
    { key: "shares", label: "Shares" },
    { key: "engagement", label: "Engagement" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top performing posts</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No published posts in this range yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Post</TableHead>
                  <TableHead>Platform</TableHead>
                  {headers.map((h) => (
                    <TableHead key={h.key} className="text-right">
                      <button
                        onClick={() => setSortKey(h.key)}
                        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                      >
                        {h.label}
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(({ post, engagement }) => (
                  <TableRow key={post.id}>
                    <TableCell className="max-w-56 truncate font-medium">
                      {post.title || truncateText(post.content, 40)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(post.platforms as Platform[]).map((p) => (
                          <Badge key={p} variant="secondary" className="text-[10px]">
                            {getPlatformLabel(p)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{metric({ post, engagement }, "likes")}</TableCell>
                    <TableCell className="text-right tabular-nums">{metric({ post, engagement }, "comments")}</TableCell>
                    <TableCell className="text-right tabular-nums">{metric({ post, engagement }, "shares")}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{engagement}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
