import { createContext, useContext, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBrands } from "@/hooks/useBrands";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { accountsForBrand, ALL_BRANDS, UNGROUPED } from "@/lib/brandScope";
import type { Brand, ConnectedAccount } from "@/types/database";
import { sessionChoice, saveSessionChoice } from "@/lib/workspaceSession";

type BrandScope = {
  brandId: string; brandName: string; brands: Brand[]; accounts: ConnectedAccount[];
  allAccounts: ConnectedAccount[]; accountIds: string[]; ready: boolean; isError: boolean;
  setBrandId: (id: string) => void;
};
const BrandContext = createContext<BrandScope | null>(null);

export function BrandProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const brandQuery = useBrands();
  const accountQuery = useConnectedAccounts();
  const brands = brandQuery.data ?? [];
  const allAccounts = accountQuery.data ?? [];
  const [selection, setSelection] = useState({ owner: "", id: "" });
  const storageKey = user ? `socialverse:brand:${user.id}` : "";
  const requested = selection.owner === user?.id ? selection.id : storageKey ? sessionChoice(storageKey) ?? "" : "";
  const brandId = requested === ALL_BRANDS || requested === UNGROUPED || brands.some((b) => b.id === requested)
    ? requested : brands[0]?.id ?? UNGROUPED;
  const accounts = accountsForBrand(allAccounts, brandId);
  return <BrandContext.Provider value={{ brandId, brands, accounts, allAccounts,
    accountIds: accounts.map((a) => a.id),
    brandName: brandId === ALL_BRANDS ? "All brands" : brandId === UNGROUPED ? "Unassigned accounts" : brands.find((b) => b.id === brandId)?.name ?? "Your brand",
    ready: Boolean(user) && brandQuery.isSuccess && accountQuery.isSuccess,
    isError: brandQuery.isError || accountQuery.isError,
    setBrandId: (id) => {
      if (storageKey) saveSessionChoice(storageKey, id);
      setSelection({ owner: user?.id ?? "", id });
    },
  }}>{children}</BrandContext.Provider>;
}

export function useBrandScope() {
  const context = useContext(BrandContext);
  if (!context) throw new Error("BrandProvider is required");
  return context;
}

export function useScopedAccounts() {
  const scope = useBrandScope();
  return { data: scope.accounts, isLoading: !scope.ready && !scope.isError, isError: scope.isError };
}
