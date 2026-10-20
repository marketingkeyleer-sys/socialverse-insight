import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PlatformConfig } from "@/types/platform";

export function PlatformCard({
  config,
  onConnect,
  connecting,
  disabled,
  label,
}: {
  config: PlatformConfig;
  onConnect: () => void;
  connecting: boolean;
  disabled?: boolean;
  // Overrides the card's subtitle/button copy for the "connect one more of
  // this platform" case, so it doesn't just repeat "Not connected" next to
  // accounts that already are.
  label?: string;
}) {
  const Icon = config.icon;

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
        <span
          className="grid h-14 w-14 place-items-center rounded-2xl text-white"
          style={{ backgroundColor: config.color }}
        >
          <Icon className="h-7 w-7" />
        </span>
        <div>
          <p className="font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">{label ? "Add another" : "Not connected"}</p>
        </div>
        <Button size="sm" className="w-full" onClick={onConnect} disabled={connecting || disabled}>
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : label ?? "Connect"}
        </Button>
      </CardContent>
    </Card>
  );
}
