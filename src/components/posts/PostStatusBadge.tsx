import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PostStatus } from "@/types/database";

const STYLES: Record<PostStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  publishing: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  published: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  partially_failed: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  failed: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const LABELS: Record<PostStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  publishing: "Publishing",
  published: "Published",
  partially_failed: "Partially failed",
  failed: "Failed",
};

export function PostStatusBadge({ status }: { status: PostStatus }) {
  return (
    <Badge variant="outline" className={cn("border-0 font-medium", STYLES[status])}>
      {LABELS[status]}
    </Badge>
  );
}
