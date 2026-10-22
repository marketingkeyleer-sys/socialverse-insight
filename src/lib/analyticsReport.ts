import { endOfDay, startOfDay, startOfWeek, startOfMonth, subDays, differenceInCalendarDays, format } from "date-fns";
import type { AnalyticsSnapshot, ConnectedAccount, PlatformPost } from "@/types/database";
export type ReportPreset = "today" | "yesterday" | "week" | "month" | "7" | "30" | "90" | "custom";
export interface ReportRange { from: Date; to: Date }
export const dateKey = (date: Date) => format(date, "yyyy-MM-dd");
export function reportRange(preset: Exclude<ReportPreset, "custom">, now = new Date()): ReportRange {
  const to = preset === "yesterday" ? endOfDay(subDays(now, 1)) : endOfDay(now);
  const from = preset === "today" ? startOfDay(now) : preset === "yesterday" ? startOfDay(subDays(now, 1)) : preset === "week" ? startOfWeek(now, { weekStartsOn: 1 }) : preset === "month" ? startOfMonth(now) : startOfDay(subDays(now, Number(preset) - 1));
  return { from, to };
}
export function previousRange(range: ReportRange): ReportRange {
  const days = differenceInCalendarDays(range.to, range.from) + 1;
  return { from: startOfDay(subDays(range.from, days)), to: endOfDay(subDays(range.from, 1)) };
}
export function percentChange(current: number | null, previous: number | null): number | null {
  return current === null || previous === null || previous === 0 ? null : (current - previous) / previous * 100;
}
export function postsInRange<T extends Pick<PlatformPost, "posted_at">>(posts: T[], range: ReportRange): T[] {
  return posts.filter(p => { const time = new Date(p.posted_at).getTime(); return time >= range.from.getTime() && time <= range.to.getTime(); });
}
export function channelReport(accounts: ConnectedAccount[], snapshots: AnalyticsSnapshot[], posts: PlatformPost[], range: ReportRange) {
  const previous = previousRange(range);
  return accounts.map(account => {
    const history = snapshots.filter(s => s.connected_account_id === account.id).sort((a,b) => a.metric_date.localeCompare(b.metric_date));
    const current = history.filter(s => s.metric_date >= dateKey(range.from) && s.metric_date <= dateKey(range.to));
    const baseline = history.filter(s => s.metric_date >= dateKey(previous.from) && s.metric_date <= dateKey(previous.to)).at(-1);
    const latest = current.at(-1);
    const connectionDate = account.last_synced_at ?? account.connected_at;
    const providerObservation = account.platform === "linkedin_page" && account.scopes?.includes("socialverse:upload-post") && connectionDate && new Date(connectionDate) >= range.from && new Date(connectionDate) <= range.to;
    const ownPosts = posts.filter(p => p.connected_account_id === account.id);
    const selectedPosts = postsInRange(ownPosts, range);
    const previousPosts = postsInRange(ownPosts, previous);
    const reachValues = selectedPosts.filter(p => p.reach !== null);
    const previousReach = previousPosts.filter(p => p.reach !== null);
    const engagement = (items: PlatformPost[]) => items.reduce((sum,p) => sum + p.likes_count + p.comments_count + p.shares_count, 0);
    return { account, followers: latest?.followers ?? (providerObservation ? account.followers_count : null), observedDate: latest?.metric_date ?? (providerObservation ? dateKey(new Date(connectionDate)) : undefined),
      growth: latest && baseline ? latest.followers - baseline.followers : null,
      followersChange: percentChange(latest?.followers ?? null, baseline?.followers ?? null),
      posts: selectedPosts.length, postsChange: percentChange(selectedPosts.length, previousPosts.length),
      reach: reachValues.length ? reachValues.reduce((sum,p) => sum + (p.reach ?? 0), 0) : null,
      reachChange: percentChange(reachValues.length ? reachValues.reduce((sum,p) => sum + (p.reach ?? 0),0) : null, previousReach.length ? previousReach.reduce((sum,p) => sum + (p.reach ?? 0),0) : null),
      engagements: selectedPosts.length ? engagement(selectedPosts) : null,
      engagementsChange: percentChange(selectedPosts.length ? engagement(selectedPosts) : null, previousPosts.length ? engagement(previousPosts) : null),
      coverage: reachValues.length, views: selectedPosts.reduce((sum,p) => sum + (p.views_count ?? 0),0),
    };
  });
}
export type ChannelReportRow = ReturnType<typeof channelReport>[number];
