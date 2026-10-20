export const ALL_BRANDS = "__all__";
export const UNGROUPED = "__ungrouped__";

export function accountsForBrand<T extends { brand_id: string | null }>(accounts: T[], brandId: string): T[] {
  if (brandId === ALL_BRANDS) return accounts;
  return accounts.filter((account) => account.brand_id === (brandId === UNGROUPED ? null : brandId));
}

export function postBrandFilter(brandId: string, accountIds: string[]): string | null {
  if (brandId === ALL_BRANDS) return null;
  const legacy = accountIds.length ? `and(brand_id.is.null,connected_account_ids.ov.{${accountIds.join(",")}})` : null;
  if (brandId === UNGROUPED) return `and(brand_id.is.null,connected_account_ids.is.null),and(brand_id.is.null,connected_account_ids.eq.{})${legacy ? `,${legacy}` : ""}`;
  return `brand_id.eq.${brandId}${legacy ? `,${legacy}` : ""}`;
}

export function platformFollowerTotals<T extends { platform: string; followers_count: number }>(accounts: T[]) {
  const totals = new Map<string, number>();
  for (const account of accounts) totals.set(account.platform, (totals.get(account.platform) ?? 0) + account.followers_count);
  return totals;
}
