import { Activity } from "lucide-react";
import { getRelativeTime } from "@/lib/utils";
import type { ActivityLogEntry } from "@/types/database";

export function describeAction(entry: ActivityLogEntry): string {
  const map: Record<string, string> = {
    account_created: "Account created",
    account_connected: "Connected a social account",
    account_disconnected: "Disconnected a social account",
    post_created: "Created a post",
    post_published: "Published a post",
    post_partially_failed: "Post published on some platforms, failed on others",
    post_failed: "Scheduled post failed to publish",
    post_deleted: "Deleted a post",
    sync_failed: "Account sync failed",
    sync_warning: "Account synced with some data missing",
  };
  const label = map[entry.action] ?? entry.action;
  const meta = entry.metadata as { platform?: string; error?: string; warnings?: string[] } | null;
  if (entry.action === "sync_failed" && meta?.platform) {
    return `${label} (${meta.platform})${meta.error ? `: ${meta.error}` : ""}`;
  }
  if (entry.action === "sync_warning" && meta?.platform) {
    return `${label} (${meta.platform})${meta.warnings?.[0] ? `: ${meta.warnings[0]}` : ""}`;
  }
  return label;
}

export function isFailureAction(action: string): boolean {
  return action === "post_failed" || action === "post_partially_failed" || action === "sync_failed" || action === "sync_warning";
}

export function ActivityLog({ entries }: { entries: ActivityLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ul className="space-y-1">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-accent">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Activity className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm">{describeAction(entry)}</p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{getRelativeTime(entry.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}
