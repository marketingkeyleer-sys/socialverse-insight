import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformColor, getPlatformLabel } from "@/lib/platforms";
import type { PostingActivityDay } from "@/hooks/usePostingActivity";
import type { Platform } from "@/types/database";

const BAR_PLATFORMS: Platform[] = ["facebook", "instagram", "youtube", "linkedin"];

export function PostingActivityChart({
  data,
  onSelectDate,
}: {
  data: PostingActivityDay[];
  onSelectDate: (date: string) => void;
}) {
  const activePlatforms = BAR_PLATFORMS.filter((p) => data.some((d) => d[p] > 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Posting activity</CardTitle>
        <p className="text-xs text-muted-foreground">Posts per day, by platform. Click a bar to see that day's posts.</p>
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No posts in this period</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} cursor={{ fill: "var(--muted)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => getPlatformLabel(value as Platform)} />
              {(activePlatforms.length > 0 ? activePlatforms : BAR_PLATFORMS).map((p) => (
                <Bar
                  key={p}
                  dataKey={p}
                  name={p}
                  stackId="posts"
                  fill={getPlatformColor(p)}
                  radius={0}
                  className="cursor-pointer"
                  onClick={(row: { payload?: PostingActivityDay }) => {
                    if (row.payload) onSelectDate(row.payload.date);
                  }}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
