import { motion } from "motion/react";
import { useEffect } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { Brand } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { getSocialDashboard, type SocialDashboardData } from "@/lib/social-analytics.functions";
import { getConnectedPlatforms, type PlatformStatus } from "@/lib/connected-platforms.functions";

type Platform = SocialDashboardData["platforms"][number];
type Kpi = SocialDashboardData["kpis"][number];

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard · SocialVerse Analytics" }] }),
});

const platformNav = [
  { id: "overview" as const, label: "Overview" },
  { id: "instagram" as const, label: "Instagram" },
  { id: "facebook" as const, label: "Facebook" },
  { id: "youtube" as const, label: "YouTube" },
  { id: "linkedin" as const, label: "LinkedIn" },
  { id: "reports" as const, label: "Reports" },
];

function useConnectedPlatforms() {
  const { user, isReady } = useAuthReady();
  const fetchPlatforms = useServerFn(getConnectedPlatforms);
  return useQuery({
    queryKey: ["connected-platforms", user?.id],
    queryFn: () => fetchPlatforms(),
    enabled: isReady && !!user,
    refetchOnWindowFocus: false,
  });
}

function Sidebar({ active = "overview" }: { active?: string }) {
  const { data: platformsData } = useConnectedPlatforms();
  const connectedMap = new Map<string, boolean>(
    platformsData?.platforms.map((p: PlatformStatus) => [p.platform, p.connected]) ?? []
  );

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-white/5 bg-background/40 backdrop-blur-xl lg:flex">
      <div className="px-6 py-5"><Brand /></div>
      <nav className="flex-1 px-3 py-2 text-sm">
        <div className="px-3 pb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Workspace</div>
        {platformNav.map((item, index) => {
          const isOverview = item.id === "overview";
          const isActive = active === item.id;
          const isConnected = isOverview ? false : connectedMap.get(item.id) ?? false;
          return (
            <button
              key={item.id}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                isActive ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isActive ? "bg-primary" : isConnected ? "bg-lime" : "bg-muted-foreground/40"
                }`}
                title={isConnected ? "Connected" : isOverview ? "" : "Not connected"}
              />
              <span className="flex-1">{item.label}</span>
              {isConnected && !isOverview && (
                <span className="rounded-full bg-lime/10 px-1.5 py-0.5 text-[9px] font-medium text-lime">On</span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="m-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs font-medium text-muted-foreground">Data source</div>
        <div className="mt-1 font-display text-lg leading-tight">OAuth-connected accounts only</div>
        <Link to="/connections" className="mt-3 inline-flex rounded-full bg-gradient-primary px-3 py-1.5 text-xs font-medium text-background shadow-glow">
          Manage connections
        </Link>
      </div>
    </aside>
  );
}

function Topbar({ liveCount, connectedCount, refresh }: { liveCount: number; connectedCount: number; refresh: () => void }) {
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-background/70 px-6 py-3 backdrop-blur-xl">
      <div>
        <div className="text-xs text-muted-foreground">Workspace · {connectedCount} connected · {liveCount} live</div>
        <div className="font-display text-xl">Real-time social analytics</div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={refresh} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10">Refresh</button>
        <Link to="/connections" className="rounded-full bg-gradient-primary px-3 py-1.5 text-xs font-medium text-background shadow-glow">Connect accounts</Link>
        <button onClick={signOut} className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 md:inline-flex">Sign out</button>
      </div>
    </div>
  );
}

function KpiCard({ k, i }: { k: Kpi; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className="glass shadow-card relative overflow-hidden rounded-2xl p-5"
    >
      <div
        className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-30 blur-2xl"
        style={{ background: `var(--${k.accent})` }}
      />
      <div className="text-xs text-muted-foreground">{k.label}</div>
      <div className="mt-1 font-display text-3xl">{k.value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{k.detail}</div>
    </motion.div>
  );
}

function Panel({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass shadow-card rounded-2xl p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">{title}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass shadow-card rounded-2xl p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary text-background">↗</div>
      <h1 className="mt-5 font-display text-3xl">Connect real social accounts</h1>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        The dashboard no longer uses demo numbers. Connect Instagram, Facebook Page, YouTube, or LinkedIn to fetch live analytics from the authorized account.
      </p>
      <Link to="/connections" className="mt-6 inline-flex rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-medium text-background shadow-glow">
        Go to connections
      </Link>
    </div>
  );
}

function PlatformCard({ platform, index }: { platform: Platform; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="glass shadow-card rounded-2xl p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {platform.avatarUrl ? (
            <img src={platform.avatarUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
          ) : (
            <span className="h-10 w-10 rounded-xl" style={{ background: platform.color }} />
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium">{platform.name}</div>
            <div className="truncate text-xs text-muted-foreground">{platform.accountName}</div>
          </div>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] ${platform.live ? "bg-lime/10 text-lime" : platform.connected ? "bg-amber/10 text-amber" : "bg-white/5 text-muted-foreground"}`}>
          {platform.live ? "Live" : platform.connected ? "Needs access" : "Offline"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div><div className="font-display text-xl">{new Intl.NumberFormat("en", { notation: "compact" }).format(platform.followers)}</div><div className="text-muted-foreground">Followers</div></div>
        <div><div className="font-display text-xl">{new Intl.NumberFormat("en", { notation: "compact" }).format(platform.reach)}</div><div className="text-muted-foreground">Reach</div></div>
        <div><div className="font-display text-xl">{platform.engagementRate.toFixed(1)}%</div><div className="text-muted-foreground">Eng.</div></div>
      </div>
      <div className="mt-4 h-16">
        <ResponsiveContainer>
          <LineChart data={platform.series}>
            <Line type="monotone" dataKey="reach" stroke={platform.color} strokeWidth={2} dot={false}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 border-t border-white/5 pt-3 text-xs text-muted-foreground">{platform.status}</div>
    </motion.div>
  );
}

function LoadingDashboard() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1">
        <div className="sticky top-0 z-30 border-b border-white/5 bg-background/70 px-6 py-4 backdrop-blur-xl">
          <div className="h-6 w-64 animate-pulse rounded bg-white/10" />
        </div>
        <div className="grid grid-cols-2 gap-4 p-6 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass h-32 animate-pulse rounded-2xl" />)}
        </div>
      </main>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { user, isReady } = useAuthReady();
  const fetchDashboard = useServerFn(getSocialDashboard);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["social-dashboard", user?.id],
    queryFn: () => fetchDashboard(),
    enabled: isReady && !!user,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (isReady && !user) navigate({ to: "/login", replace: true });
  }, [isReady, navigate, user]);

  if (!isReady || !user || isLoading) return <LoadingDashboard />;
  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="glass max-w-lg rounded-2xl p-6 text-center">
          <h1 className="font-display text-2xl">Analytics could not load</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Please try again."}</p>
          <button onClick={() => refetch()} className="mt-5 rounded-full bg-gradient-primary px-4 py-2 text-sm font-medium text-background shadow-glow">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1">
        <Topbar liveCount={data.liveCount} connectedCount={data.connectedCount} refresh={() => refetch()} />
        <div className="space-y-5 p-6">
          {data.connectedCount === 0 ? <EmptyState /> : null}

          {data.notices.length > 0 && (
            <div className="rounded-2xl border border-amber/25 bg-amber/10 p-4 text-sm text-amber">
              {data.notices.map((notice) => <div key={notice.platform}>{notice.platform}: {notice.message}</div>)}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {data.kpis.map((k, i) => <KpiCard key={k.label} k={k} i={i} />)}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Audience reach" sub="Live provider data · last 30 days" className="xl:col-span-2">
              <div className="h-72">
                <ResponsiveContainer>
                  <AreaChart data={data.growthSeries}>
                    <defs>
                      <linearGradient id="reachFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.70 0.22 295)" stopOpacity={0.7}/>
                        <stop offset="100%" stopColor="oklch(0.70 0.22 295)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="impressionFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.82 0.15 195)" stopOpacity={0.55}/>
                        <stop offset="100%" stopColor="oklch(0.82 0.15 195)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                    <XAxis dataKey="label" stroke="oklch(0.70 0.03 270)" fontSize={11} tickLine={false} axisLine={false}/>
                    <YAxis stroke="oklch(0.70 0.03 270)" fontSize={11} tickLine={false} axisLine={false}/>
                    <Tooltip contentStyle={{ background: "oklch(0.20 0.024 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12, fontSize: 12 }}/>
                    <Area type="monotone" dataKey="reach" stroke="oklch(0.70 0.22 295)" fill="url(#reachFill)" strokeWidth={2}/>
                    <Area type="monotone" dataKey="impressions" stroke="oklch(0.82 0.15 195)" fill="url(#impressionFill)" strokeWidth={2}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Platform mix" sub="Follower distribution">
              <div className="h-72">
                {data.platformShare.length > 0 ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={data.platformShare} dataKey="value" innerRadius={55} outerRadius={95} paddingAngle={3} stroke="none">
                        {data.platformShare.map((p, i) => <Cell key={i} fill={p.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "oklch(0.20 0.024 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12, fontSize: 12 }}/>
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "oklch(0.70 0.03 270)" }}/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">Connect accounts with follower access to see distribution.</div>
                )}
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.platforms.map((platform, index) => <PlatformCard key={platform.id} platform={platform} index={index} />)}
          </div>

          <Panel title="Top performing posts" sub="Fetched from connected providers">
            <div className="overflow-hidden rounded-xl border border-white/5">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Platform</th>
                    <th className="px-4 py-3 text-left font-medium">Post</th>
                    <th className="px-4 py-3 text-right font-medium">Reach</th>
                    <th className="px-4 py-3 text-right font-medium">Engagement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.topPosts.length > 0 ? data.topPosts.map((post) => (
                    <tr key={`${post.platform}-${post.title}`} className="hover:bg-white/5">
                      <td className="px-4 py-3 text-xs text-muted-foreground">{post.platform}</td>
                      <td className="px-4 py-3">{post.url ? <a href={post.url} target="_blank" rel="noreferrer" className="hover:text-primary">{post.title}</a> : post.title}</td>
                      <td className="px-4 py-3 text-right">{new Intl.NumberFormat("en", { notation: "compact" }).format(post.reach)}</td>
                      <td className="px-4 py-3 text-right text-lime">{new Intl.NumberFormat("en", { notation: "compact" }).format(post.engagement)}</td>
                    </tr>
                  )) : (
                    <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>No post analytics available from the connected providers yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </main>
    </div>
  );
}