import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TourStep({ onFinish, loading }: { onFinish: () => void; loading: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-8 w-8" />
      </span>
      <h1 className="text-2xl font-semibold">You're all set!</h1>
      <p className="max-w-sm text-muted-foreground">
        Your dashboard is ready. Compose your first post, or explore your analytics as data comes in.
      </p>
      <Button onClick={onFinish} size="lg" className="mt-2" disabled={loading}>
        Go to dashboard
      </Button>
    </div>
  );
}
