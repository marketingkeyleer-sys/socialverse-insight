import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BulkActions({
  count,
  onClear,
  onDelete,
}: {
  count: number;
  onClear: () => void;
  onDelete: () => void;
}) {
  if (count === 0) return null;

  return (
    <div className="sticky top-16 z-20 flex items-center justify-between rounded-lg border bg-card p-3 shadow-sm">
      <span className="text-sm font-medium">{count} selected</span>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="mr-1 h-3.5 w-3.5" />
          Clear
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Delete selected
        </Button>
      </div>
    </div>
  );
}
