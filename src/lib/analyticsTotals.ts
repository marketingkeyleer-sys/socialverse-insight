export interface FollowerSnapshot { connected_account_id: string; metric_date: string; followers: number }

// Accounts often sync on different dates. Use each account's last observed
// total, rather than dropping accounts missing on the global latest day.
export function followerTotals(rows: FollowerSnapshot[]) {
  const accounts = new Map<string, { first: FollowerSnapshot; last: FollowerSnapshot }>();
  for (const row of rows) {
    const value = accounts.get(row.connected_account_id);
    if (!value) accounts.set(row.connected_account_id, { first: row, last: row });
    else {
      if (row.metric_date < value.first.metric_date) value.first = row;
      if (row.metric_date > value.last.metric_date) value.last = row;
    }
  }
  return [...accounts.values()].reduce((sum, row) => ({ first: sum.first + row.first.followers, last: sum.last + row.last.followers }), { first: 0, last: 0 });
}
