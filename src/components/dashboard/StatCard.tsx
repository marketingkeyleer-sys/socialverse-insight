import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  changePct,
  color,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  changePct?: number;
  /** Any CSS color — defaults to the theme's primary accent when omitted. */
  color?: string;
}) {
  const isUp = (changePct ?? 0) >= 0;

  return (
    <Card className="overflow-hidden">
      <div className="h-1" style={{ backgroundColor: color ?? "var(--primary)" }} />
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
          {changePct !== undefined && (
            <span
              className={cn(
                "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                isUp ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400",
              )}
            >
              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(changePct).toFixed(1)}%
            </span>
          )}
        </div>
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: `color-mix(in oklch, ${color ?? "var(--primary)"} 15%, transparent)`, color: color ?? "var(--primary)" }}
        >
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}
