import { Button } from "@/components/ui/button";
import { PlatformCard } from "@/components/accounts/PlatformCard";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { PLATFORM_CONFIGS } from "@/lib/platforms";
import type { Platform } from "@/types/database";
import { useState } from "react";
import { MetaConnectDialog, type MetaPlatform } from "@/components/accounts/MetaConnectDialog";

// LinkedIn Page is a specialized business feature — it needs a registered
// company and LinkedIn's Community Management API approval, which almost
// no one signing up has. Showing it here, next to the everyday platforms,
// would just confuse first-time users and fail for nearly everyone. It's
// still available on the full Accounts page for anyone who needs it.
const ONBOARDING_PLATFORMS = PLATFORM_CONFIGS.filter((c) => c.id !== "linkedin_page" && c.id !== "whatsapp");

export function ConnectStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { data: accounts = [], connect } = useConnectedAccounts();
  const connectedPlatforms = new Set(accounts.map((a) => a.platform));
  const [metaPlatform, setMetaPlatform] = useState<MetaPlatform | null>(null);

  return (
    <div className="space-y-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Connect your accounts</h1>
        <p className="mt-1 text-muted-foreground">Connect at least one platform to unlock the dashboard.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ONBOARDING_PLATFORMS.map((config) =>
          connectedPlatforms.has(config.id) ? (
            <div key={config.id} className="flex flex-col items-center gap-2 rounded-xl border border-primary bg-primary/5 p-6">
              <span className="grid h-14 w-14 place-items-center rounded-2xl text-white" style={{ backgroundColor: config.color }}>
                <config.icon className="h-7 w-7" />
              </span>
              <p className="text-sm font-medium">{config.label}</p>
              <p className="text-xs text-primary">Connected</p>
            </div>
          ) : (
            <PlatformCard
              key={config.id}
              config={config}
              onConnect={() => {
                if (config.id === "facebook" || config.id === "instagram") {
                  connect.reset();
                  setMetaPlatform(config.id);
                } else connect.mutate({ platform: config.id as Platform });
              }}
              connecting={connect.isPending && connect.variables?.platform === config.id}
            />
          ),
        )}
      </div>

      {metaPlatform && <MetaConnectDialog key={metaPlatform} platform={metaPlatform} brandName="Unassigned accounts"
        pending={connect.isPending} error={connect.error?.message}
        onClose={() => setMetaPlatform(null)} onContinue={() => connect.mutate({platform: metaPlatform})} />}

      <div className="flex justify-center gap-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={connectedPlatforms.size === 0}>
          Continue
        </Button>
      </div>
    </div>
  );
}
