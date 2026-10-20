import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformColor, getPlatformIcon, getPlatformLabel } from "@/lib/platforms";
import { formatNumber } from "@/lib/utils";
import type { PlatformPerformance } from "@/hooks/useAnalytics";
import type { Platform } from "@/types/database";

export function BestPerformerCard({ performance }: { performance: PlatformPerformance[] }) {
  const withReach = performance.filter((p) => p.reach > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-amber-500" /> Best for reach
        </CardTitle>
      </CardHeader>
      <CardContent>
        {withReach.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No reach data yet for this period — check back after your next sync.
          </p>
        ) : (
          <div className="space-y-3">
            {withReach.map((p, i) => {
              const Icon = getPlatformIcon(p.platform as Platform);
              const color = getPlatformColor(p.platform as Platform);
              const maxReach = withReach[0].reach;
              const pct = maxReach > 0 ? (p.reach / maxReach) * 100 : 0;
              return (
                <div key={p.platform} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      {i === 0 && <Trophy className="h-3.5 w-3.5 text-amber-500" />}
                      <Icon className="h-3.5 w-3.5" style={{ color }} />
                      {getPlatformLabel(p.platform as Platform)}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{formatNumber(p.reach)} reach</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
