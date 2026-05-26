import { motion } from "motion/react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { Brand } from "@/components/brand";
import {
  kpis, platforms, growthSeries, platformShare, adSpendSeries, topPosts, messages,
} from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard · SocialVerse Analytics" }] }),
});

const nav = [
  { label: "Overview", active: true },
  { label: "Instagram" },
  { label: "TikTok" },
  { label: "YouTube" },
  { label: "LinkedIn" },
  { label: "Facebook" },
  { label: "X / Twitter" },
  { label: "Ads" },
  { label: "Inbox" },
  { label: "Content" },
  { label: "AI co-pilot" },
  { label: "Reports" },
];

function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-white/5 bg-background/40 backdrop-blur-xl lg:flex">
      <div className="px-6 py-5"><Brand /></div>
      <nav className="flex-1 px-3 py-2 text-sm">
        <div className="px-3 pb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Workspace</div>
        {nav.map((n) => (
          <button
            key={n.label}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
              n.active ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${n.active ? "bg-primary" : "bg-muted-foreground/40"}`} />
            {n.label}
          </button>
        ))}
      </nav>
      <div className="m-3 rounded-xl bg-gradient-primary p-4 text-background">
        <div className="text-xs font-medium opacity-80">Upgrade</div>
        <div className="font-display text-lg leading-tight">Go Pro — unlock all platforms</div>
        <button className="mt-3 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground">Upgrade</button>
      </div>
    </aside>
  );
}

function Topbar() {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-background/70 px-6 py-3 backdrop-blur-xl">
      <div>
        <div className="text-xs text-muted-foreground">Workspace · Northwind Studio</div>
        <div className="font-display text-xl">Overview</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground md:flex">
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="9" r="6"/><path d="m17 17-3.5-3.5"/></svg>
          Search analytics, posts, DMs…
        </div>
        <button className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs">Last 30 days</button>
        <button className="rounded-full bg-gradient-primary px-3 py-1.5 text-xs font-medium text-background shadow-glow">Export PDF</button>
        <Link to="/" className="ml-2 h-8 w-8 rounded-full bg-gradient-primary ring-2 ring-background" />
      </div>
    </div>
  );
}

function KpiCard({ k, i }: { k: typeof kpis[number]; i: number }) {
  const positive = k.delta >= 0;
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
      <div className={`mt-1 inline-flex items-center gap-1 text-xs ${positive ? "text-lime" : "text-destructive"}`}>
        <span>{positive ? "▲" : "▼"}</span> {Math.abs(k.delta)}% vs. last period
      </div>
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

function Dashboard() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1">
        <Topbar />
        <div className="space-y-5 p-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {kpis.map((k, i) => <KpiCard key={k.label} k={k} i={i} />)}
          </div>

          {/* Row 1: growth + share */}
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Audience growth" sub="Followers & reach · last 30 days" className="xl:col-span-2">
              <div className="h-72">
                <ResponsiveContainer>
                  <AreaChart data={growthSeries}>
                    <defs>
                      <linearGradient id="d1" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.70 0.22 295)" stopOpacity={0.7}/>
                        <stop offset="100%" stopColor="oklch(0.70 0.22 295)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="d2" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.82 0.15 195)" stopOpacity={0.55}/>
                        <stop offset="100%" stopColor="oklch(0.82 0.15 195)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                    <XAxis dataKey="day" stroke="oklch(0.70 0.03 270)" fontSize={11} tickLine={false} axisLine={false}/>
                    <YAxis stroke="oklch(0.70 0.03 270)" fontSize={11} tickLine={false} axisLine={false}/>
                    <Tooltip contentStyle={{ background: "oklch(0.20 0.024 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12, fontSize: 12 }}/>
                    <Area type="monotone" dataKey="followers" stroke="oklch(0.70 0.22 295)" fill="url(#d1)" strokeWidth={2}/>
                    <Area type="monotone" dataKey="reach" stroke="oklch(0.82 0.15 195)" fill="url(#d2)" strokeWidth={2}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Platform mix" sub="Followers distribution">
              <div className="h-72">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={platformShare} dataKey="value" innerRadius={55} outerRadius={95} paddingAngle={3} stroke="none">
                      {platformShare.map((p, i) => <Cell key={i} fill={p.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "oklch(0.20 0.024 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12, fontSize: 12 }}/>
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "oklch(0.70 0.03 270)" }}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          {/* Row 2: platform cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {platforms.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass shadow-card rounded-2xl p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  <span className={`text-xs ${p.growth >= 0 ? "text-lime" : "text-destructive"}`}>
                    {p.growth >= 0 ? "▲" : "▼"} {Math.abs(p.growth)}%
                  </span>
                </div>
                <div className="mt-3 font-display text-2xl">{(p.followers / 1000).toFixed(1)}K</div>
                <div className="text-xs text-muted-foreground">followers</div>
                <div className="mt-4 h-16">
                  <ResponsiveContainer>
                    <LineChart data={growthSeries.slice(-14)}>
                      <Line type="monotone" dataKey="followers" stroke={p.color} strokeWidth={2} dot={false}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Row 3: ads + engagement */}
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Ad spend vs ROAS" sub="12-month performance" className="xl:col-span-2">
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={adSpendSeries}>
                    <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                    <XAxis dataKey="month" stroke="oklch(0.70 0.03 270)" fontSize={11} tickLine={false} axisLine={false}/>
                    <YAxis stroke="oklch(0.70 0.03 270)" fontSize={11} tickLine={false} axisLine={false}/>
                    <Tooltip contentStyle={{ background: "oklch(0.20 0.024 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12, fontSize: 12 }}/>
                    <Bar dataKey="spend" fill="oklch(0.70 0.22 295)" radius={[6,6,0,0]} />
                    <Bar dataKey="roas" fill="oklch(0.82 0.15 195)" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Engagement rate" sub="Average across platforms">
              <div className="h-72">
                <ResponsiveContainer>
                  <LineChart data={growthSeries}>
                    <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false}/>
                    <XAxis dataKey="day" stroke="oklch(0.70 0.03 270)" fontSize={11} tickLine={false} axisLine={false}/>
                    <YAxis stroke="oklch(0.70 0.03 270)" fontSize={11} tickLine={false} axisLine={false}/>
                    <Tooltip contentStyle={{ background: "oklch(0.20 0.024 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12, fontSize: 12 }}/>
                    <Line type="monotone" dataKey="engagement" stroke="oklch(0.75 0.20 350)" strokeWidth={2.5} dot={false}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          {/* Row 4: top posts + inbox */}
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Top performing posts" sub="By reach · last 30 days" className="xl:col-span-2">
              <div className="overflow-hidden rounded-xl border border-white/5">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Platform</th>
                      <th className="px-4 py-3 text-left font-medium">Post</th>
                      <th className="px-4 py-3 text-right font-medium">Reach</th>
                      <th className="px-4 py-3 text-right font-medium">Eng.</th>
                      <th className="px-4 py-3 text-right font-medium">Likes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {topPosts.map((p) => (
                      <tr key={p.title} className="hover:bg-white/5">
                        <td className="px-4 py-3 text-xs text-muted-foreground">{p.platform}</td>
                        <td className="px-4 py-3">{p.title}</td>
                        <td className="px-4 py-3 text-right">{p.reach}</td>
                        <td className="px-4 py-3 text-right text-lime">{p.eng}</td>
                        <td className="px-4 py-3 text-right">{p.likes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel title="Unified inbox" sub={`${messages.filter(m => m.unread).length} unread`}>
              <div className="space-y-1">
                {messages.map((m) => (
                  <div key={m.from} className="group flex items-start gap-3 rounded-xl p-3 transition hover:bg-white/5">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-primary text-xs font-medium text-background">
                      {m.from.replace("@","").slice(0,2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm">{m.from}</span>
                        <span className="text-[10px] text-muted-foreground">{m.time}</span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{m.text}</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">{m.platform}</div>
                    </div>
                    {m.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* AI co-pilot */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-primary p-6 text-background shadow-glow md:p-8">
            <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/30 blur-3xl"/>
            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div>
                <div className="text-xs font-medium opacity-80">AI CO-PILOT</div>
                <h3 className="mt-1 font-display text-2xl md:text-3xl">3 growth experiments ready for this week</h3>
                <p className="mt-2 max-w-xl text-sm text-background/80">
                  Based on your last 30 days, posting 9-second TikToks at 18:40 and reusing your top 3 LinkedIn hooks could lift reach by ~24%.
                </p>
              </div>
              <button className="rounded-full bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:opacity-90">
                Review suggestions
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
