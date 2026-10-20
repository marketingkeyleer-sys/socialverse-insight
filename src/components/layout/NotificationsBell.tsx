import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActivityLog } from "@/hooks/useActivityLog";
import { describeAction, isFailureAction } from "@/components/settings/ActivityLog";
import { getRelativeTime } from "@/lib/utils";

// Scheduled posts and account syncs happen server-side, with no browser tab
// open and no toast to show — this is the only place that failure (or
// success) is visible at all, short of manually checking /posts.
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { recent } = useActivityLog(15);
  const entries = recent.data ?? [];

  const recentFailures = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return entries.filter((e) => isFailureAction(e.action) && new Date(e.created_at).getTime() > cutoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {recentFailures.length > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-sm font-medium">Account activity · all brands</div>
        {recent.isLoading ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {entries.map((entry) => {
              const failed = isFailureAction(entry.action);
              return (
                <li key={entry.id} className="flex items-start gap-2.5 px-3 py-2 text-sm hover:bg-accent">
                  {failed ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={failed ? "text-destructive" : undefined}>{describeAction(entry)}</p>
                    <p className="text-xs text-muted-foreground">{getRelativeTime(entry.created_at)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-t px-3 py-2 text-center">
          <Link
            to="/settings"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setOpen(false)}
          >
            View all in Settings
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
