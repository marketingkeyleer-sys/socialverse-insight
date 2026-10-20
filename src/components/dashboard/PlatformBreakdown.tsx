import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformColor, getPlatformLabel } from "@/lib/platforms";
import type { ConnectedAccount, Platform } from "@/types/database";

export function PlatformBreakdown({ accounts }: { accounts: ConnectedAccount[] }) {
  const data = accounts.map((a) => ({
    name: getPlatformLabel(a.platform as Platform),
    value: a.followers_count,
    color: getPlatformColor(a.platform as Platform),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Followers by platform</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Connect an account to see this
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
