import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/posts/PostCard";
import type { Post } from "@/types/database";
import { Link } from "react-router-dom";

export function PostList({
  posts,
  selectedIds,
  onToggleSelect,
  onDelete,
  onDuplicate,
  emptyMessage,
}: {
  posts: Post[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  emptyMessage: string;
}) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        <Button asChild size="sm">
          <Link to="/compose">Compose a post</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          selected={selectedIds.has(post.id)}
          onToggleSelect={() => onToggleSelect(post.id)}
          onDelete={() => onDelete(post.id)}
          onDuplicate={() => onDuplicate(post.id)}
        />
      ))}
    </div>
  );
}
