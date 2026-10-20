import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getPlatformColor, getPlatformLabel } from "@/lib/platforms";
import type { AnalyticsSnapshot, Platform } from "@/types/database";

type Metric = "reach" | "impressions";

// Same shape as FollowersChart, one line per platform, but for reach/
// impressions instead of followers — the trend detail that was missing
// entirely before (only combined totals existed as stat cards).
export function ReachImpressionsChart({ snapshots }: { snapshots: AnalyticsSnapshot[] }) {
  const [metric, setMetric] = useState<Metric>("reach");
  const platforms = [...new Set(snapshots.map((s) => s.platform))] as Platform[];
  const byDate = new Map<string, Record<string, number | string>>();

  for (const s of snapshots) {
    const row = byDate.get(s.metric_date) ?? { date: s.metric_date };
    row[s.platform] = (Number(row[s.platform]) || 0) + s[metric];
    byDate.set(s.metric_date, row);
  }
  const data = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Reach &amp; impressions</CardTitle>
        <div className="flex gap-1">
          <Button size="sm" variant={metric === "reach" ? "default" : "outline"} onClick={() => setMetric("reach")}>
            Reach
          </Button>
          <Button size="sm" variant={metric === "impressions" ? "default" : "outline"} onClick={() => setMetric("impressions")}>
            Impressions
          </Button>
        </div>
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
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => getPlatformLabel(value as Platform)} />
              {platforms.map((p) => (
                <Line
                  key={p}
                  type="monotone"
                  dataKey={p}
                  name={p}
                  stroke={getPlatformColor(p)}
                  strokeWidth={2}
                  dot={{ r: 3, fill: getPlatformColor(p) }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
