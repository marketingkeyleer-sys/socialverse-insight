import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformColor, getPlatformLabel } from "@/lib/platforms";
import type { AnalyticsSnapshot, Platform } from "@/types/database";

export function FollowersChart({ snapshots }: { snapshots: AnalyticsSnapshot[] }) {
  const platforms = [...new Set(snapshots.map((s) => s.platform))] as Platform[];
  const byDate = new Map<string, Record<string, number | string>>();

  for (const s of snapshots) {
    const row = byDate.get(s.metric_date) ?? { date: s.metric_date };
    row[s.platform] = (Number(row[s.platform]) || 0) + s.followers;
    byDate.set(s.metric_date, row);
  }
  const data = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Follower growth</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                labelFormatter={(v) => String(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => getPlatformLabel(value as Platform)} />
              {platforms.map((p) => (
                <Line
                  key={p}
                  type="monotone"
                  dataKey={p}
                  name={p}
                  stroke={getPlatformColor(p)}
                  strokeWidth={2}
                  // Instagram/YouTube only have today's single real data
                  // point (no historical backfill yet) — a line needs 2+
                  // points to draw at all, so without a dot that platform
                  // was rendering as literally nothing on the chart.
                  dot={{ r: 3, fill: getPlatformColor(p) }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
