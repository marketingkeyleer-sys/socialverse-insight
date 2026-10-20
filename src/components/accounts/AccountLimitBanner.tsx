import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function AccountLimitBanner({ current, max }: { current: number; max: number }) {
  if (current < max) return null;

  return (
    <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-amber-700 dark:text-amber-300">
          You've reached your plan's limit of {max} connected accounts. Upgrade to connect more.
        </p>
      </div>
      <Button asChild size="sm" variant="outline" className="shrink-0">
        <Link to="/settings">Upgrade plan</Link>
      </Button>
    </div>
  );
}
