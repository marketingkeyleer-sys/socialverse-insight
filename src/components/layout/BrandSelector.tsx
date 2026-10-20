import { Building2 } from "lucide-react";
import { useBrandScope } from "@/contexts/BrandContext";
import { ALL_BRANDS, UNGROUPED } from "@/lib/brandScope";

export function BrandSelector() {
  const { brandId, brands, setBrandId, ready } = useBrandScope();
  return <div className="flex min-w-0 items-center gap-2">
    <span className="hidden rounded-lg bg-primary/10 p-2 text-primary sm:block"><Building2 className="h-4 w-4" /></span>
    <div className="min-w-0"><label htmlFor="active-brand" className="hidden text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:block">Brand workspace</label>
      <select id="active-brand" aria-label="Active brand" value={brandId} disabled={!ready} onChange={(e) => setBrandId(e.target.value)} className="max-w-[180px] rounded-md border bg-card px-2 py-1.5 text-sm font-medium sm:max-w-[280px]">
        {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
        <option value={UNGROUPED}>Unassigned accounts</option><option value={ALL_BRANDS}>All brands · portfolio</option>
      </select>
    </div>
  </div>;
}
