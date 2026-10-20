import { Link } from "react-router-dom";
import { Copy, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PostStatusBadge } from "@/components/posts/PostStatusBadge";
import { getPlatformLabel } from "@/lib/platforms";
import { formatDate, truncateText } from "@/lib/utils";
import type { Platform, Post } from "@/types/database";

export function PostCard({
  post,
  selected,
  onToggleSelect,
  onDelete,
  onDuplicate,
}: {
  post: Post;
  selected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const when = post.published_at ?? post.scheduled_at ?? post.created_at;

  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="mt-1" />
        <Link to={`/posts/${post.id}`} className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{post.title || truncateText(post.content, 60)}</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{post.content}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {post.platforms.map((p) => (
              <Badge key={p} variant="secondary" className="text-[10px]">
                {getPlatformLabel(p as Platform)}
              </Badge>
            ))}
            <PostStatusBadge status={post.status} />
            <span className="text-xs text-muted-foreground">{formatDate(when)}</span>
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={`/compose?id=${post.id}`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}
