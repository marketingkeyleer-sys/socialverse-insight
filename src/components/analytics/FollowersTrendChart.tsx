import { FollowersChart } from "@/components/dashboard/FollowersChart";
import type { AnalyticsSnapshot } from "@/types/database";

// Same multi-line-per-platform chart used on the dashboard overview — kept
// as one implementation so the two pages never visually drift apart.
export function FollowersTrendChart({ snapshots }: { snapshots: AnalyticsSnapshot[] }) {
  return <FollowersChart snapshots={snapshots} />;
}
