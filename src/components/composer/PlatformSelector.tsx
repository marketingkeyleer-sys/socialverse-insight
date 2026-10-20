import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PLATFORM_CONFIGS } from "@/lib/platforms";
import { cn } from "@/lib/utils";
import type { ConnectedAccount } from "@/types/database";

export function PlatformSelector({
  accounts,
  selected,
  onToggle,
}: {
  accounts: ConnectedAccount[];
  selected: string[];
  onToggle: (accountId: string) => void;
}) {
  const connectedPlatforms = new Set(accounts.map((a) => a.platform));

  if (connectedPlatforms.size === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No accounts connected yet.{" "}
        <Link to="/accounts" className="font-medium text-primary underline-offset-2 hover:underline">
          Connect one
        </Link>{" "}
        to start composing.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
      {accounts.filter((a) => a.is_active).map((account) => {
        const config = PLATFORM_CONFIGS.find((p) => p.id === account.platform)!;
        const isConnected = true;
        const isSelected = selected.includes(account.id);
        const Icon = config.icon;

        return (
          <label
            key={account.id}
            className={cn(
              "flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors",
              !isConnected && "cursor-not-allowed opacity-40",
              isConnected && "cursor-pointer hover:bg-accent",
              isSelected && "border-primary bg-primary/5",
            )}
          >
            <Checkbox
              checked={isSelected}
              disabled={!isConnected}
              onCheckedChange={() => onToggle(account.id)}
            />
            <Icon className="h-4 w-4 shrink-0" style={{ color: config.color }} />
            <Label className="cursor-pointer font-normal">{account.platform_display_name ?? account.platform_username ?? config.label} <span className="text-xs text-muted-foreground">({config.label})</span></Label>
          </label>
        );
      })}
    </div>
  );
}
