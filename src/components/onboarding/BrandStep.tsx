import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBrands } from "@/hooks/useBrands";
import { useBrandScope } from "@/contexts/BrandContext";

export function BrandStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const scope = useBrandScope();
  const { createBrand } = useBrands();
  const [name, setName] = useState("");
  const selected = scope.brands.some(brand => brand.id === scope.brandId);
  return <div className="space-y-6">
    <div className="text-center"><h1 className="text-2xl font-semibold">Set up your brand</h1>
      <p className="mt-2 text-sm text-muted-foreground">A brand is a company or business. Its accounts, followers and reports stay together in its own workspace.</p></div>
    {!scope.ready && !scope.isError && <p role="status">Loading your brands…</p>}
    {scope.isError && <p role="alert" className="text-sm text-destructive">Could not load your workspace. Reload to try again, or finish setup and create your brand from Accounts later.</p>}
    {scope.brands.length > 0 && <div className="space-y-2"><Label htmlFor="onboarding-brand">Use an existing brand</Label>
      <select id="onboarding-brand" className="w-full rounded-md border bg-background p-2 text-sm" value={selected ? scope.brandId : ""} onChange={event => scope.setBrandId(event.target.value)}>
        <option value="" disabled>Choose your brand</option>{scope.brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
      </select></div>}
    <form className="space-y-3 rounded-xl border p-4" onSubmit={event => {
      event.preventDefault();
      if (!name.trim() || createBrand.isPending) return;
      createBrand.mutate(name.trim(), { onSuccess: brand => { scope.setBrandId(brand.id); onNext(); } });
    }}><Label htmlFor="onboarding-brand-name">{scope.brands.length ? "Or create another brand" : "Brand name"}</Label>
      <Input id="onboarding-brand-name" placeholder="Your company or brand" maxLength={120} required value={name} onChange={event => setName(event.target.value)} disabled={createBrand.isPending}/>
      {createBrand.error && <p role="alert" className="text-sm text-destructive">{createBrand.error.message}</p>}
      <Button type="submit" className="w-full" disabled={!name.trim() || !scope.ready || createBrand.isPending}>{createBrand.isPending ? "Creating brand…" : "Create brand and continue"}</Button>
    </form>
    <div className="flex flex-wrap justify-center gap-2"><Button variant="ghost" onClick={onBack} disabled={createBrand.isPending}>Back</Button>
      {selected && <Button onClick={onNext} disabled={createBrand.isPending}>Use {scope.brandName}</Button>}
      <Button variant="outline" onClick={onNext} disabled={createBrand.isPending}>Set up later</Button></div>
  </div>;
}
