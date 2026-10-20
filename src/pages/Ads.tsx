import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Megaphone, Pause, Play, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NewCampaignDialog } from "@/components/ads/NewCampaignDialog";
import { useScopedAccounts as useConnectedAccounts } from "@/contexts/BrandContext";
import {
  useAdAccounts,
  useAdCampaigns,
  useSyncAdPerformance,
  useUpdateAdStatus,
  type CampaignWithChildren,
} from "@/hooks/useAds";
import { formatDate, formatNumber } from "@/lib/utils";
import type { AdStatus } from "@/types/database";

function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_VARIANT: Record<AdStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  active: "default",
  paused: "secondary",
  completed: "secondary",
  failed: "destructive",
};

function StatusToggle({
  level,
  id,
  status,
}: {
  level: "campaign" | "adSet" | "ad";
  id: string;
  status: AdStatus;
}) {
  const updateStatus = useUpdateAdStatus();
  if (status !== "active" && status !== "paused") return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;

  return (
    <div className="flex items-center gap-2">
      <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
      <Button
        size="sm"
        variant="outline"
        className="h-6 px-2 text-xs"
        disabled={updateStatus.isPending}
        onClick={() => updateStatus.mutate({ level, id, status: status === "active" ? "paused" : "active" })}
      >
        {status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </Button>
    </div>
  );
}

function CampaignRow({ campaign }: { campaign: CampaignWithChildren }) {
  const [expanded, setExpanded] = useState(false);
  const syncPerformance = useSyncAdPerformance();

  const allAds = campaign.sv_ad_sets.flatMap((s) => s.sv_ads);
  const totalSpend = allAds.reduce((sum, a) => sum + (a.spend_cents ?? 0), 0);
  const totalImpressions = allAds.reduce((sum, a) => sum + (a.impressions ?? 0), 0);
  const totalClicks = allAds.reduce((sum, a) => sum + (a.clicks ?? 0), 0);

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setExpanded((e) => !e)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            <div>
              <CardTitle className="text-base">{campaign.name}</CardTitle>
              <p className="text-xs text-muted-foreground">{campaign.objective.replace("OUTCOME_", "")}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-xs text-muted-foreground">
              <p>{formatCents(totalSpend)} spent</p>
              <p>
                {formatNumber(totalImpressions)} impressions · {formatNumber(totalClicks)} clicks
              </p>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <StatusToggle level="campaign" id={campaign.id} status={campaign.status} />
            </div>
          </div>
        </div>
        {campaign.error_message && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3 shrink-0" /> {campaign.error_message}
          </p>
        )}
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4 border-t pt-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={syncPerformance.isPending}
              onClick={() => syncPerformance.mutate(campaign.id)}
            >
              {syncPerformance.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Sync performance
            </Button>
          </div>
          {campaign.sv_ad_sets.map((adSet) => (
            <div key={adSet.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{adSet.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCents(adSet.daily_budget_cents)}/day · {formatDate(adSet.start_time)}
                    {adSet.end_time ? ` – ${formatDate(adSet.end_time)}` : " – ongoing"}
                  </p>
                </div>
                <StatusToggle level="adSet" id={adSet.id} status={adSet.status} />
              </div>
              {adSet.error_message && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3 shrink-0" /> {adSet.error_message}
                </p>
              )}
              <div className="mt-3 space-y-2">
                {adSet.sv_ads.map((ad) => (
                  <div key={ad.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-2 text-xs">
                    <span className="font-medium">{ad.name}</span>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{formatCents(ad.spend_cents)} spent</span>
                      <span>{ad.impressions !== null ? formatNumber(ad.impressions) : "—"} impr.</span>
                      <span>{ad.clicks !== null ? formatNumber(ad.clicks) : "—"} clicks</span>
                      <StatusToggle level="ad" id={ad.id} status={ad.status} />
                    </div>
                    {ad.error_message && <p className="w-full text-destructive">{ad.error_message}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export default function AdsPage() {
  const { data: accounts = [] } = useConnectedAccounts();
  const facebookAccount = accounts.find((a) => a.platform === "facebook");
  const { list: adAccountsQuery, refresh: refreshAdAccounts } = useAdAccounts();
  const { data: campaigns = [], isLoading: campaignsLoading } = useAdCampaigns();

  const adAccounts = adAccountsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ads Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real Meta campaigns — every campaign is created paused. Activating one spends real budget from your ad
            account.
          </p>
        </div>
        {adAccounts.length > 0 && <NewCampaignDialog adAccounts={adAccounts} />}
      </div>

      {!facebookAccount ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Megaphone className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Connect a Facebook account to use Ads Manager.</p>
            <Button asChild size="sm">
              <Link to="/accounts">Connect an account</Link>
            </Button>
          </CardContent>
        </Card>
      ) : adAccounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Megaphone className="h-8 w-8 text-muted-foreground" />
            <p className="max-w-md text-sm text-muted-foreground">
              No ad accounts found yet. This needs the <code className="rounded bg-muted px-1">ads_management</code>{" "}
              permission — if it hasn't been approved by Meta for this app yet, this will fail with a permissions
              error, which is expected until App Review completes.
            </p>
            <Button
              onClick={() => refreshAdAccounts.mutate(facebookAccount.id)}
              disabled={refreshAdAccounts.isPending}
            >
              {refreshAdAccounts.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Fetch ad accounts from Meta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {adAccounts.length} ad account{adAccounts.length === 1 ? "" : "s"} connected
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refreshAdAccounts.mutate(facebookAccount.id)}
              disabled={refreshAdAccounts.isPending}
            >
              {refreshAdAccounts.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
          </div>

          {campaignsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          ) : campaigns.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No campaigns yet — click "New campaign" to create one.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <CampaignRow key={c.id} campaign={c} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
