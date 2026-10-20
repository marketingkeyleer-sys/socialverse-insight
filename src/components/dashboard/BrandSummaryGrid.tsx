import { ArrowUpRight, Building2 } from "lucide-react";
import { useBrandScope } from "@/contexts/BrandContext";
import { accountsForBrand, ALL_BRANDS, UNGROUPED } from "@/lib/brandScope";
import { getPlatformConfig } from "@/lib/platforms";
import { formatNumber } from "@/lib/utils";

export function BrandSummaryGrid() {
  const scope = useBrandScope();
  if (scope.brandId !== ALL_BRANDS) return null;
  const groups = [...scope.brands, { id: UNGROUPED, name: "Unassigned accounts", color: null }];
  return <section className="space-y-3" aria-label="Brands overview"><div><h2 className="text-lg font-semibold">Your brand portfolio</h2><p className="text-sm text-muted-foreground">Each company has its own channels, audience and content.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{groups.map((brand) => {
      const accounts = accountsForBrand(scope.allAccounts, brand.id);
      const platforms = [...new Set(accounts.map((a) => a.platform))];
      return <button key={brand.id} onClick={() => scope.setBrandId(brand.id)} className="rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:border-primary/50 hover:shadow-md">
        <div className="flex items-center justify-between gap-3"><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Building2 className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></div>
        <h3 className="mt-4 font-semibold">{brand.name}</h3><p className="mt-1 text-xs text-muted-foreground">{accounts.length} connected {accounts.length === 1 ? "channel" : "channels"}</p>
        <p className="mt-4 text-2xl font-semibold tabular-nums">{formatNumber(accounts.reduce((sum, a) => sum + a.followers_count, 0))}</p><p className="text-xs text-muted-foreground">Combined platform followers / subscribers</p>
        <div className="mt-4 flex gap-2">{platforms.map((platform) => { const config = getPlatformConfig(platform); return <span key={platform} title={config.label} className="grid h-7 w-7 place-items-center rounded-md" style={{ color: config.color, background: `${config.color}15` }}><config.icon className="h-4 w-4" /></span>; })}</div>
      </button>;
    })}</div>
  </section>;
}
