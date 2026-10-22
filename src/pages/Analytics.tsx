import { useState } from "react";
import { Download, Users, FileText, Heart, Eye, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/analytics/DateRangePicker";
import { FollowersTrendChart } from "@/components/analytics/FollowersTrendChart";
import { ReachImpressionsChart } from "@/components/analytics/ReachImpressionsChart";
import { PostsBarChart } from "@/components/analytics/PostsBarChart";
import { PostEngagementChart } from "@/components/analytics/PostEngagementChart";
import { PlatformPostsTable } from "@/components/analytics/PlatformPostsTable";
import { ChannelPerformanceTable } from "@/components/analytics/ChannelPerformanceTable";
import { useReportSnapshots } from "@/hooks/useReportSnapshots";
import { useAllPlatformPosts } from "@/hooks/useAllPlatformPosts";
import { useBrandScope } from "@/contexts/BrandContext";
import { PLATFORM_CONFIGS, getPlatformIcon } from "@/lib/platforms";
import { channelReport, dateKey, postsInRange, previousRange, reportRange, type ReportPreset } from "@/lib/analyticsReport";
import { cn, formatNumber } from "@/lib/utils";
import type { Platform } from "@/types/database";
const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  const safe = typeof value === "string" && /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};
export default function Analytics() {
  const scope = useBrandScope();
  const [range, setRange] = useState(() => reportRange("30"));
  const [preset, setPreset] = useState<ReportPreset>("30");
  const [platform, setPlatform] = useState<Platform>();
  const previous = previousRange(range);
  const history = useReportSnapshots(range);
  const postsQuery = useAllPlatformPosts(platform, {from:previous.from, to:range.to});
  const accounts = platform ? scope.accounts.filter(a => a.platform === platform) : scope.accounts;
  const snapshots = (history.data ?? []).filter(s => (!platform || s.platform === platform) && s.metric_date >= dateKey(range.from) && s.metric_date <= dateKey(range.to));
  const posts = postsInRange(postsQuery.data ?? [], range);
  const rows = channelReport(accounts, history.data ?? [], postsQuery.data ?? [], range);
  const isLoading = history.isLoading || postsQuery.isLoading;
  const error = history.error || postsQuery.error;
  const followers = rows.filter(r => r.followers !== null);
  const reaches = rows.filter(r => r.reach !== null);
  const engagements = rows.filter(r => r.engagements !== null);
  const metrics = [
    {label:"Observed audience", value:followers.length ? formatNumber(followers.reduce((sum,r) => sum + (r.followers ?? 0),0)) : "—", note:`${followers.length}/${rows.length} channels with history · not unique people`, icon:Users, color:"text-teal-600", bg:"bg-teal-500/10"},
    {label:"Published content", value:formatNumber(posts.length), note:"Synced posts and videos published in this period", icon:FileText, color:"text-blue-600", bg:"bg-blue-500/10"},
    {label:"Post engagements", value:engagements.length ? formatNumber(engagements.reduce((sum,r) => sum + (r.engagements ?? 0),0)) : "—", note:"Lifetime likes + comments + shares on selected posts", icon:Heart, color:"text-rose-600", bg:"bg-rose-500/10"},
    {label:"Available post reach", value:reaches.length ? formatNumber(reaches.reduce((sum,r) => sum + (r.reach ?? 0),0)) : "—", note:"Lifetime reach · available posts only · not deduplicated", icon:Eye, color:"text-violet-600", bg:"bg-violet-500/10"},
  ];
  const handleExport = () => {
    const header=["Brand","From","To","Channel","Platform","Followers","Net follower change","Posts","Post lifetime reach","Post lifetime engagements","Audience change %","Posts change %","Reach change %","Engagements change %","Reach coverage posts"];
    const records=rows.map(r => [scope.brandName,dateKey(range.from),dateKey(range.to),r.account.platform_display_name ?? r.account.platform_username,r.account.platform,r.followers,r.growth,r.posts,r.reach,r.engagements,r.followersChange,r.postsChange,r.reachChange,r.engagementsChange,r.coverage]);
    const blob=new Blob(['\uFEFF'+[header,...records].map(row => row.map(csvCell).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`socialverse-${scope.brandName.replace(/[^a-z0-9]+/gi,"-")}-${dateKey(range.from)}-${dateKey(range.to)}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return <div className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-7">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.2em] text-primary">{scope.brandName} / Analytics</p><h1 className="text-3xl font-semibold tracking-tight">Performance report</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Understand every channel, compare your progress and see the content behind the numbers.</p></div><Button variant="outline" onClick={handleExport} disabled={isLoading || Boolean(error) || !rows.length}><Download className="mr-2 h-4 w-4"/>Export report</Button></header>
    <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm" aria-label="Report filters"><DateRangePicker range={range} preset={preset} onChange={(value,key) => {setRange(value);setPreset(key);}}/><div className="flex flex-wrap items-center gap-2 border-t pt-4"><span className="mr-1 text-xs font-medium text-muted-foreground">Channels</span><button aria-pressed={!platform} onClick={() => setPlatform(undefined)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold",!platform ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent")}>All platforms</button>{PLATFORM_CONFIGS.filter(p => scope.accounts.some(a => a.platform === p.id)).map(p => {const Icon=getPlatformIcon(p.id);return <button key={p.id} aria-pressed={platform === p.id} onClick={() => setPlatform(p.id)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",platform === p.id ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent")}><Icon className="h-3.5 w-3.5"/>{p.label}</button>;})}</div><p className="text-[11px] text-muted-foreground">Compared with {format(previous.from,"d MMM yyyy")} – {format(previous.to,"d MMM yyyy")} · All sections and exports follow these filters.</p></section>
    {error ? <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm"><AlertCircle className="h-5 w-5 text-destructive"/><span>We couldn't load the complete report. Please retry.</span><Button variant="outline" size="sm" onClick={() => {void history.refetch();void postsQuery.refetch();}}>Retry</Button></div> : isLoading ? <div className="space-y-4"><Skeleton className="h-72 rounded-2xl"/><Skeleton className="h-28 rounded-2xl"/></div> : <>
      <ChannelPerformanceTable rows={rows}/>
      {accounts.some(account => account.platform === "linkedin_page") && <p className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs leading-6 text-muted-foreground">LinkedIn Pages are included in this brand's report. Provider monitoring imports up to 100 recent posts and refreshes engagement for the latest 20. Audience growth and daily trends require historical observations; a connection does not supply a full historical report.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(m => <div key={m.label} className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-medium text-muted-foreground">{m.label}</p><span className={cn("rounded-lg p-2",m.bg,m.color)}><m.icon className="h-4 w-4"/></span></div><p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{m.value}</p><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{m.note}</p></div>)}</div>
      <div className="pt-2"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Explore the detail</p><h2 className="mt-1 text-xl font-semibold">Trends & publishing activity</h2><p className="mt-1 text-xs text-muted-foreground">Daily data appears where history has been synced. Gaps indicate missing observations.</p></div>
      <FollowersTrendChart snapshots={snapshots}/>
      <PostEngagementChart posts={posts}/>
      <div className="grid gap-5 xl:grid-cols-2"><ReachImpressionsChart snapshots={snapshots}/><PostsBarChart posts={posts}/></div>
      <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground"><p className="font-semibold text-foreground">How to read this report</p><p className="mt-1">Audience history is limited to saved snapshots. The daily chart uses the existing sync fields: YouTube views are currently stored in the impressions series; they are not unique reach. Some platforms store zeros when insights are unavailable. Post details show a dash for unavailable reach, impressions or views. Counts reflect synced content, which may not include all historical posts.</p></div>
      <PlatformPostsTable posts={posts}/>
    </>}
  </div>;
}

