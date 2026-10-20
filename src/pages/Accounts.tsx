import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountLimitBanner } from "@/components/accounts/AccountLimitBanner";
import { AccountRow } from "@/components/accounts/AccountRow";
import { SetupChecklist } from "@/components/accounts/SetupChecklist";
import { WhatsAppConnectDialog } from "@/components/accounts/WhatsAppConnectDialog";
import { OAuthAccountPicker } from "@/components/accounts/OAuthAccountPicker";
import { MetaConnectDialog, type MetaPlatform } from "@/components/accounts/MetaConnectDialog";
import { useAuth } from "@/hooks/useAuth";
import { useBrands } from "@/hooks/useBrands";
import { availability, useConnectionStatus } from "@/hooks/useConnectionStatus";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { PLATFORM_CONFIGS, getPlatformLabel } from "@/lib/platforms";
import type { Brand, Platform } from "@/types/database";
import { useBrandScope } from "@/contexts/BrandContext";
import { ALL_BRANDS, UNGROUPED } from "@/lib/brandScope";

type Accounts = ReturnType<typeof useConnectedAccounts>;

// One brand = one card with a row for every platform. Each platform holds at
// most one account per brand, so a connected platform shows its account and
// an empty one shows a Connect button — nothing else to choose or scroll.
function BrandCard({
  brand,
  accounts,
  atLimit,
  actions,
  brands,
  onConnectWhatsApp,
  onDelete,
  reconnect,
  platformStatus,
}: {
  brand: Brand;
  accounts: NonNullable<Accounts["data"]>;
  atLimit: boolean;
  actions: Accounts;
  brands: Brand[];
  onConnectWhatsApp: (brandId: string) => void;
  onDelete: () => void;
  reconnect: (platform: Platform, brandId: string | null) => void;
  platformStatus: ReturnType<typeof useConnectionStatus>["data"];
}) {
  const mine = accounts.filter((a) => a.brand_id === brand.id);
  const { connect, disconnect, sync, setSyncInterval, setBrand } = actions;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-3">
        <h2 className="font-medium">{brand.name}</h2>
        <Badge variant="secondary">
          {mine.length} of {PLATFORM_CONFIGS.length} connected
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          title={`Delete ${brand.name} (its accounts stay connected)`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="divide-y">
        {PLATFORM_CONFIGS.map((config) => {
          const account = mine.find((a) => a.platform === config.id);
          if (account) {
            return (
              <AccountRow
                key={account.id}
                account={account}
                brands={brands}
                syncing={sync.isPending && sync.variables === account.id}
                onSync={() => sync.mutate(account.id)}
                onDisconnect={() => disconnect.mutate(account.id)}
                onIntervalChange={(minutes) => setSyncInterval.mutate({ accountId: account.id, minutes })}
                onMove={(brandId) => setBrand.mutate({ accountId: account.id, brandId })}
                onReconnect={() => reconnect(account.platform as Platform, account.brand_id)}
              />
            );
          }
          const Icon = config.icon;
          const avail = availability(platformStatus?.platforms, config.id as Platform);
          // The official Cloud API route doesn't need the shared QR service.
          const unavailable = !avail.ready && !(config.id === "whatsapp" && platformStatus?.cloudApiAvailable);
          const connecting = connect.isPending && connect.variables?.platform === config.id && connect.variables?.brandId === brand.id;
          return (
            <div key={config.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white opacity-60" style={{ backgroundColor: config.color }}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{config.label}</p>
                <p className="text-xs text-muted-foreground">{!avail.ready ? avail.reason : "Not connected"}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={atLimit || connecting || (unavailable && config.id !== "whatsapp")}
                title={atLimit ? "You've reached your plan's account limit" : undefined}
                onClick={() =>
                  config.id === "whatsapp"
                    ? onConnectWhatsApp(brand.id)
                    : reconnect(config.id as Platform, brand.id)
                }
              >
                {connecting ? "Opening…" : unavailable && config.id !== "whatsapp" ? "Unavailable" : "Connect"}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function Accounts() {
  const scope = useBrandScope();
  const { user, profile } = useAuth();
  const actions = useConnectedAccounts();
  const { data: platformStatus } = useConnectionStatus();
  const { data: accounts = [], isLoading, disconnect, sync, setSyncInterval, setBrand } = actions;
  const { data: brands = [], isLoading: brandsLoading, createBrand, deleteBrand } = useBrands();
  const maxAccounts = profile?.max_connected_accounts ?? 4;
  const atLimit = accounts.length >= maxAccounts;
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [newBrandOpen, setNewBrandOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [whatsAppDialog, setWhatsAppDialog] = useState<{ brandId: string | null } | null>(null);
  const [metaDialog, setMetaDialog] = useState<{platform: MetaPlatform; brandId: string | null} | null>(null);

  // The oauth-callback Edge Function redirects here with ?connected=<platform>
  // or ?connect_error=<message>&platform=<platform> once the provider round-trip
  // finishes — surface that outcome once, then strip it from the URL.
  useEffect(() => {
    const connected = searchParams.get("connected");
    const connectedCount = searchParams.get("connectedCount");
    const connectError = searchParams.get("connect_error");
    const platform = searchParams.get("platform") as Platform | null;
    if (!connected && !connectError) return;

    if (connected) {
      const label = getPlatformLabel(connected as Platform);
      toast.success(connectedCount ? `Connected ${connectedCount} ${label} accounts!` : `Connected ${label}!`);
      queryClient.invalidateQueries({ queryKey: ["connected-accounts", user?.id] });
    } else if (connectError) {
      toast.error(platform ? `${getPlatformLabel(platform)}: ${connectError}` : connectError);
    }

    const next = new URLSearchParams(searchParams);
    next.delete("connected");
    next.delete("connectedCount");
    next.delete("connect_error");
    next.delete("platform");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const unbranded = accounts.filter((a) => !a.brand_id);

  // Re-running a platform's login refreshes its token in place (same account,
  // same brand). WhatsApp has no login to repeat, so it goes to its page.
  function reconnect(platform: Platform, brandId: string | null) {
    if (platform === "whatsapp") return;
    if (platform === "facebook" || platform === "instagram") {
      actions.connect.reset();
      setMetaDialog({platform, brandId});
      return;
    }
    actions.connect.mutate({ platform, brandId });
  }

  function handleCreateBrand() {
    const name = newBrandName.trim();
    if (!name) return;
    createBrand.mutate(name, {
      onSuccess: (brand) => {
        scope.setBrandId(brand.id);
        setNewBrandName("");
        setNewBrandOpen(false);
      },
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Connected accounts</h1>
            <Badge variant="secondary">
              {scope.accounts.length} in workspace · {maxAccounts === 2147483647 ? "Unlimited plan" : `${accounts.length} / ${maxAccounts} total`}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {scope.brandName} · Each brand is a separate company. Connect and manage its own platform accounts here.
          </p>
        </div>
        <Button size="sm" onClick={() => setNewBrandOpen(true)}>
          <Plus className="h-4 w-4" />
          New brand
        </Button>
      </div>

      <AccountLimitBanner current={accounts.length} max={maxAccounts} />
      {searchParams.get("connection_request") && <OAuthAccountPicker
        key={searchParams.get("connection_request")!}
        requestId={searchParams.get("connection_request")!}
        onClose={() => { const next = new URLSearchParams(searchParams); next.delete("connection_request"); setSearchParams(next, { replace: true }); }}
      />}

      <div className="flex flex-wrap gap-2">
        {PLATFORM_CONFIGS.filter((p) => p.id !== "whatsapp").map((p) => <Button key={p.id} variant="outline" size="sm"
          disabled={atLimit || actions.connect.isPending}
          onClick={() => reconnect(p.id as Platform, scope.brandId === ALL_BRANDS || scope.brandId === UNGROUPED ? null : scope.brandId)}><p.icon className="h-4 w-4" style={{ color: p.color }} />Add {p.id === "facebook" ? "Facebook Page" : p.label}</Button>)}
      </div>
      <div className="rounded-xl border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="mb-1 font-semibold text-foreground">Connect the accounts you manage</p>
        <p><strong>Facebook:</strong> sign in with your normal Facebook account to connect a Page. <strong>Instagram:</strong> connect a Business or Creator account linked to a Facebook Page. Personal accounts get setup instructions before login.</p>
      </div>
      {metaDialog && <MetaConnectDialog key={`${metaDialog.platform}:${metaDialog.brandId}`} platform={metaDialog.platform}
        brandName={brands.find(brand => brand.id === metaDialog.brandId)?.name ?? "Unassigned accounts"}
        pending={actions.connect.isPending} error={actions.connect.error?.message}
        onClose={() => setMetaDialog(null)} onContinue={() => actions.connect.mutate(metaDialog)} />}

      {!isLoading && !brandsLoading && (
        <SetupChecklist brands={brands} accounts={accounts} onCreateBrand={() => setNewBrandOpen(true)} />
      )}

      {isLoading || brandsLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : (
        <>
          {brands.length === 0 && (
            <Card className="items-center gap-3 border-dashed p-10 text-center">
              <p className="font-medium">Start by creating a brand</p>
              <p className="max-w-md text-sm text-muted-foreground">
                A brand is one business or product. Each one gets its own Facebook Page, Instagram, YouTube, LinkedIn and
                WhatsApp number, kept separate from your other brands.
              </p>
              <Button onClick={() => setNewBrandOpen(true)}>
                <Plus className="h-4 w-4" />
                Create your first brand
              </Button>
            </Card>
          )}

          {brands.filter((brand) => scope.brandId === ALL_BRANDS || brand.id === scope.brandId).map((brand) => (
            <BrandCard
              key={brand.id}
              brand={brand}
              brands={brands}
              accounts={accounts}
              atLimit={atLimit}
              actions={actions}
              onConnectWhatsApp={(brandId) => setWhatsAppDialog({ brandId })}
              onDelete={() => deleteBrand.mutate(brand.id)}
              reconnect={reconnect}
              platformStatus={platformStatus}
            />
          ))}

          {unbranded.length > 0 && (scope.brandId === ALL_BRANDS || scope.brandId === UNGROUPED) && (
            <Card className="gap-0 overflow-hidden py-0">
              <div className="border-b bg-muted/30 px-4 py-3">
                <h2 className="font-medium">Not in a brand</h2>
                <p className="text-xs text-muted-foreground">
                  Connected before brands existed. Use the menu on a row, then Move to brand, to organise them.
                </p>
              </div>
              <div className="divide-y">
                {unbranded.map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    brands={brands}
                    syncing={sync.isPending && sync.variables === account.id}
                    onSync={() => sync.mutate(account.id)}
                    onDisconnect={() => disconnect.mutate(account.id)}
                    onIntervalChange={(minutes) => setSyncInterval.mutate({ accountId: account.id, minutes })}
                    onMove={(brandId) => setBrand.mutate({ accountId: account.id, brandId })}
                onReconnect={() => reconnect(account.platform as Platform, account.brand_id)}
                  />
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <Dialog open={newBrandOpen} onOpenChange={setNewBrandOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a brand</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="e.g. RobotVerse"
            value={newBrandName}
            onChange={(e) => setNewBrandName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateBrand()}
            autoFocus
          />
          <DialogFooter>
            <Button onClick={handleCreateBrand} disabled={!newBrandName.trim() || createBrand.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WhatsAppConnectDialog
        open={whatsAppDialog !== null}
        brandId={whatsAppDialog?.brandId ?? null}
        onOpenChange={(open) => !open && setWhatsAppDialog(null)}
      />
    </div>
  );
}
