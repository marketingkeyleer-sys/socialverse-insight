import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformColor, getPlatformLabel } from "@/lib/platforms";
import type { Platform, PlatformPost } from "@/types/database";
import { dateKey } from "@/lib/analyticsReport";

function weekLabel(date: Date): string {
  const start = new Date(date);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  return dateKey(start);
}

export function PostsBarChart({ posts }: { posts: PlatformPost[] }) {
  const platforms = new Set<Platform>();
  const byWeek = new Map<string, Record<string, number | string>>();

  for (const post of posts) {
    const anchor = post.posted_at;
    const week = weekLabel(new Date(anchor));
    const row = byWeek.get(week) ?? { week };
    for (const p of [post.platform]) {
      platforms.add(p);
      row[p] = (Number(row[p]) || 0) + 1;
    }
    byWeek.set(week, row);
  }
  const data = [...byWeek.values()].sort((a, b) => String(a.week).localeCompare(String(b.week)));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Posts per week</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No posts yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => getPlatformLabel(value as Platform)} />
              {[...platforms].map((p) => (
                <Bar key={p} dataKey={p} name={p} fill={getPlatformColor(p)} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
