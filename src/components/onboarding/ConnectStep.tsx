import { Button } from "@/components/ui/button";
import { PlatformCard } from "@/components/accounts/PlatformCard";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { PLATFORM_CONFIGS } from "@/lib/platforms";
import { useState } from "react";
import { MetaConnectDialog, type MetaPlatform } from "@/components/accounts/MetaConnectDialog";
import { PlatformConnectDialog, type GuidedPlatform } from "@/components/accounts/PlatformConnectDialog";
import { availability, useConnectionStatus } from "@/hooks/useConnectionStatus";
import { useBrandScope } from "@/contexts/BrandContext";

// LinkedIn Page is a specialized business feature — it needs a registered
// company and LinkedIn's Community Management API approval, which almost
// no one signing up has. Showing it here, next to the everyday platforms,
// would just confuse first-time users and fail for nearly everyone. It's
// still available on the full Accounts page for anyone who needs it.
const ONBOARDING_PLATFORMS = PLATFORM_CONFIGS.filter((c) => c.id !== "linkedin_page" && c.id !== "whatsapp");

export function ConnectStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { data: accounts = [], connect } = useConnectedAccounts();
  const scope = useBrandScope();
  const brandId = scope.brands.some(brand => brand.id === scope.brandId) ? scope.brandId : null;
  const brandName = brandId ? scope.brandName : "Unassigned accounts";
  const connectedPlatforms = new Set(accounts.filter(account => account.brand_id === brandId).map((a) => a.platform));
  const [metaPlatform, setMetaPlatform] = useState<MetaPlatform | null>(null);
  const [guidedPlatform, setGuidedPlatform] = useState<GuidedPlatform | null>(null);
  const { data: status } = useConnectionStatus();

  return (
    <div className="space-y-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Connect your accounts</h1>
        <p className="mt-1 text-muted-foreground">Connect accounts for <strong>{brandName}</strong>, or finish setup and connect later.</p>
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
                } else {
                  connect.reset();
                  setGuidedPlatform(config.id as GuidedPlatform);
                }
              }}
              connecting={connect.isPending && connect.variables?.platform === config.id}
              disabled={!scope.ready || connect.isPending}
            />
          ),
        )}
      </div>

      {metaPlatform && <MetaConnectDialog key={metaPlatform} platform={metaPlatform} brandName={brandName}
        pending={connect.isPending} error={connect.error?.message}
        unavailableReason={!availability(status?.platforms, metaPlatform).ready ? availability(status?.platforms, metaPlatform).reason : undefined}
        onClose={() => setMetaPlatform(null)} onContinue={() => connect.mutate({platform: metaPlatform, brandId})} />}
      {guidedPlatform && <PlatformConnectDialog key={guidedPlatform} platform={guidedPlatform} brandName={brandName}
        availability={availability(status?.platforms, guidedPlatform)} pending={connect.isPending} error={connect.error?.message}
        onClose={() => setGuidedPlatform(null)} onContinue={() => connect.mutate({platform: guidedPlatform, brandId})} />}

      <div className="flex justify-center gap-2">
        <Button variant="ghost" onClick={onBack} disabled={connect.isPending}>
          Back
        </Button>
        <Button onClick={onNext} disabled={connect.isPending}>
          {connectedPlatforms.size ? "Continue" : "Connect later"}
        </Button>
      </div>
    </div>
  );
}
