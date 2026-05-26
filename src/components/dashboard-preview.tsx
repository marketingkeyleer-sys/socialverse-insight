import { motion } from "motion/react";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { growthSeries } from "@/lib/mock-data";

const stats = [
  { k: "Followers", v: "629.9K", d: "+12.8%" },
  { k: "Reach", v: "4.82M", d: "+23.1%" },
  { k: "Engagement", v: "8.7%", d: "+3.2%" },
  { k: "Ad ROAS", v: "4.6×", d: "+0.8" },
];

export function DashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      className="relative mx-auto mt-16 w-full max-w-6xl"
    >
      <div className="absolute -inset-x-10 -top-10 -bottom-10 bg-gradient-primary opacity-30 blur-3xl" />
      <div className="relative glass shadow-card rounded-2xl overflow-hidden">
        {/* fake window chrome */}
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-lime/80" />
          <span className="ml-3 text-xs text-muted-foreground">socialverse.app / dashboard</span>
        </div>
        <div className="grid grid-cols-12 gap-4 p-4 md:p-6">
          <div className="col-span-12 grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map((s, i) => (
              <motion.div
                key={s.k}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="glass rounded-xl p-4"
              >
                <div className="text-xs text-muted-foreground">{s.k}</div>
                <div className="mt-1 font-display text-2xl">{s.v}</div>
                <div className="text-xs text-lime">{s.d}</div>
              </motion.div>
            ))}
          </div>
          <div className="col-span-12 glass rounded-xl p-4 md:col-span-8">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Audience growth</div>
                <div className="text-xs text-muted-foreground">Last 30 days · all platforms</div>
              </div>
              <div className="flex gap-1 text-[10px]">
                {["7D","30D","90D"].map((t, i) => (
                  <span key={t} className={`rounded-full px-2 py-1 ${i===1 ? "bg-white/10 text-foreground" : "text-muted-foreground"}`}>{t}</span>
                ))}
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer>
                <AreaChart data={growthSeries}>
                  <defs>
                    <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.70 0.22 295)" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="oklch(0.70 0.22 295)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.82 0.15 195)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="oklch(0.82 0.15 195)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                  <XAxis dataKey="day" stroke="oklch(0.70 0.03 270)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="oklch(0.70 0.03 270)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "oklch(0.20 0.024 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12, fontSize: 12 }} />
                  <Area type="monotone" dataKey="followers" stroke="oklch(0.70 0.22 295)" fill="url(#g1)" strokeWidth={2} />
                  <Area type="monotone" dataKey="reach" stroke="oklch(0.82 0.15 195)" fill="url(#g2)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="col-span-12 glass rounded-xl p-4 md:col-span-4">
            <div className="text-sm font-medium">Top platforms</div>
            <div className="mt-3 space-y-3">
              {[
                { n: "TikTok", v: 212, p: 88, c: "var(--lime)" },
                { n: "Instagram", v: 184, p: 76, c: "var(--pink)" },
                { n: "Facebook", v: 92, p: 38, c: "var(--violet)" },
                { n: "YouTube", v: 56, p: 24, c: "var(--destructive)" },
                { n: "LinkedIn", v: 38, p: 16, c: "var(--cyan)" },
              ].map((r) => (
                <div key={r.n}>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{r.n}</span>
                    <span>{r.v}K</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${r.p}%` }}
                      transition={{ duration: 1.2, delay: 0.6, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ background: r.c }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
