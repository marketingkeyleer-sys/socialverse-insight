import { Line, LineChart, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  changePct,
  sparkline,
}: {
  label: string;
  value: string;
  changePct?: number;
  sparkline: number[];
}) {
  const isUp = (changePct ?? 0) >= 0;
  const data = sparkline.map((v, i) => ({ i, v }));

  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="mt-1 flex items-end justify-between gap-2">
          <div>
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
            {changePct !== undefined && (
              <span className={cn("text-xs font-medium", isUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                {isUp ? "+" : ""}
                {changePct.toFixed(1)}%
              </span>
            )}
          </div>
          {data.length > 1 && (
            <div className="h-10 w-20">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke={isUp ? "var(--color-emerald-500, #10b981)" : "var(--color-red-500, #ef4444)"}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
