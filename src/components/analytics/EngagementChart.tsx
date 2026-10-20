import { EngagementChart as DashboardEngagementChart } from "@/components/dashboard/EngagementChart";
import type { AnalyticsSnapshot } from "@/types/database";

export function EngagementChart({ snapshots }: { snapshots: AnalyticsSnapshot[] }) {
  return <DashboardEngagementChart snapshots={snapshots} />;
}
