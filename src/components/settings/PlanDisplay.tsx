import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PLAN_LIMITS } from "@/lib/constants";
import type { PlanTier } from "@/types/database";

export function PlanDisplay({ currentTier }: { currentTier: PlanTier }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {(Object.entries(PLAN_LIMITS) as [PlanTier, (typeof PLAN_LIMITS)[PlanTier]][]).map(([tier, plan]) => (
        <Card key={tier} className={cn(tier === currentTier && "border-primary ring-1 ring-primary")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{plan.label}</CardTitle>
              {tier === currentTier && <Badge>Current</Badge>}
            </div>
            <p className="text-2xl font-semibold">{plan.priceLabel}</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
