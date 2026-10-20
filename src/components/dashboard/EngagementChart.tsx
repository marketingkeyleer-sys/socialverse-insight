import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsSnapshot } from "@/types/database";

export function EngagementChart({ snapshots }: { snapshots: AnalyticsSnapshot[] }) {
  const byDate = new Map<string, { total: number; count: number }>();
  for (const s of snapshots) {
    const bucket = byDate.get(s.metric_date) ?? { total: 0, count: 0 };
    bucket.total += Number(s.engagement_rate);
    bucket.count += 1;
    byDate.set(s.metric_date, bucket);
  }
  const data = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { total, count }]) => ({ date, rate: Number((total / count).toFixed(2)) }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Engagement rate</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="engagementFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).slice(5)} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => [`${v}%`, "Engagement"]} />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="var(--color-primary)"
                fill="url(#engagementFill)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--color-primary)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
