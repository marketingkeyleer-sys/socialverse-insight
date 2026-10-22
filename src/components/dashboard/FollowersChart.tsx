import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformColor, getPlatformLabel } from "@/lib/platforms";
import type { AnalyticsSnapshot, Platform } from "@/types/database";
import { snapshotSeries } from "@/lib/chartMetrics";

export function FollowersChart({ snapshots }: { snapshots: AnalyticsSnapshot[] }) {
  const { platforms, data } = snapshotSeries(snapshots,"followers");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Follower observations</CardTitle>
        <p className="text-xs text-muted-foreground">One observation appears as a dot. A trend builds as daily syncs collect more data.</p>
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
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
