import type { AnalyticsSnapshot, PlatformPost } from "@/types/database";

export function hasSnapshotMetric(row: AnalyticsSnapshot, metric: string): boolean {
  return row.available_metrics == null || row.available_metrics.includes(metric);
}

export function snapshotSeries(snapshots: AnalyticsSnapshot[], metric: "followers" | "reach" | "impressions") {
  const rows = new Map<string, Record<string, string | number>>();
  const platforms = new Set<AnalyticsSnapshot["platform"]>();
  for (const snapshot of snapshots) {
    if (!hasSnapshotMetric(snapshot, metric) || !Number.isFinite(snapshot[metric])) continue;
    platforms.add(snapshot.platform);
    const row = rows.get(snapshot.metric_date) ?? {date:snapshot.metric_date};
    row[snapshot.platform] = Number(row[snapshot.platform] ?? 0) + snapshot[metric];
    rows.set(snapshot.metric_date,row);
  }
  return {platforms:[...platforms],data:[...rows.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date)))};
}

// Latest lifetime counters grouped by publication date, not daily engagement.
export function postEngagementSeries(posts: PlatformPost[]) {
  const rows = new Map<string, {date:string;likes:number;comments:number;shares:number}>();
  for (const post of posts) {
    const date = new Date(post.posted_at);
    if (!Number.isFinite(date.getTime())) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    const row = rows.get(key) ?? {date:key,likes:0,comments:0,shares:0};
    row.likes += post.likes_count ?? 0; row.comments += post.comments_count ?? 0; row.shares += post.shares_count ?? 0;
    rows.set(key,row);
  }
  return [...rows.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
