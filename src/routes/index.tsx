import { motion } from "motion/react";
import { Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { Brand } from "@/components/brand";
import { DashboardPreview } from "@/components/dashboard-preview";

const platforms = [
  { n: "Instagram", c: "var(--pink)" },
  { n: "Facebook", c: "var(--violet)" },
  { n: "LinkedIn", c: "var(--cyan)" },
  { n: "YouTube", c: "var(--destructive)" },
  { n: "TikTok", c: "var(--lime)" },
  { n: "X / Twitter", c: "var(--amber)" },
];

const features = [
  { t: "Unified analytics", d: "Reach, impressions, engagement, watch time — every metric, every platform, one canvas." },
  { t: "Ads intelligence", d: "Track spend, CPC, CPM, CTR and ROAS across Meta, TikTok, LinkedIn and Google Ads in real time." },
  { t: "Unified inbox", d: "DMs, comments and mentions in a single thread. Reply faster, never miss a lead." },
  { t: "AI co-pilot", d: "Captions, hashtags, post-performance analysis and growth experiments — generated for your brand." },
  { t: "Content studio", d: "Plan, schedule and analyze posts, reels and shorts with viral-pattern detection." },
  { t: "Team & agency", d: "Workspaces, client folders, approvals and white-label PDF reports out of the box." },
];

const pricing = [
  { name: "Starter", price: 0, blurb: "For creators getting started.", features: ["3 social accounts", "30-day analytics", "AI captions (50/mo)", "Email reports"], cta: "Start free" },
  { name: "Pro", price: 39, blurb: "For growing brands & creators.", features: ["15 social accounts", "12-month analytics", "Unified inbox", "AI co-pilot unlimited", "Scheduled reports"], cta: "Start 14-day trial", featured: true },
  { name: "Agency", price: 129, blurb: "For teams & agencies.", features: ["Unlimited accounts", "Client workspaces", "White-label PDF", "Roles & approvals", "Priority support"], cta: "Talk to sales" },
];

const testimonials = [
  { q: "We replaced four dashboards with SocialVerse. Our weekly reporting went from 6 hours to 12 minutes.", a: "Lena Park", r: "Head of Growth, Northwind" },
  { q: "The AI suggestions are eerily good. Our TikTok engagement is up 41% in two months.", a: "Marcus Vidal", r: "Creator, 2.1M followers" },
  { q: "Finally an analytics tool that doesn't look like SAP from 2008. Our clients actually open the reports.", a: "Priya Shah", r: "Founder, Above Studio" },
];

export const Route = (await import("@tanstack/react-router")).createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "SocialVerse Analytics — One dashboard for every social channel" },
      { name: "description", content: "AI-powered analytics for Instagram, TikTok, YouTube, LinkedIn, Facebook and X. Unified inbox, ads intelligence and white-label reports." },
      { property: "og:title", content: "SocialVerse Analytics" },
      { property: "og:description", content: "One dashboard for every social channel. Track growth, ads, DMs and content with an AI co-pilot." },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-glow" />
        <div className="absolute inset-x-0 top-0 h-[600px] grid-bg" />
        <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-10 text-center md:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground backdrop-blur"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime" />
            New · AI growth experiments in beta
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="mx-auto mt-6 max-w-4xl font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl"
          >
            One dashboard for{" "}
            <span className="text-gradient">every social channel.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mx-auto mt-6 max-w-2xl text-balance text-base text-muted-foreground md:text-lg"
          >
            SocialVerse pulls real-time analytics from Instagram, TikTok, YouTube,
            LinkedIn, Facebook and X — then layers an AI co-pilot on top so your
            team ships what actually grows.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Link to="/dashboard" className="rounded-full bg-gradient-primary px-6 py-3 text-sm font-medium text-background shadow-glow hover:opacity-95">
              See live dashboard
            </Link>
            <Link to="/login" className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-foreground backdrop-blur hover:bg-white/10">
              Connect your accounts
            </Link>
          </motion.div>

          {/* platform row */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground">
            <span>Connects with</span>
            {platforms.map((p) => (
              <span key={p.n} className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: p.c }} />
                {p.n}
              </span>
            ))}
          </div>

          <DashboardPreview />
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Platform</div>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">Built for the way modern teams actually grow.</h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.t}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="glass shadow-card group relative rounded-2xl p-6"
            >
              <div className="mb-5 h-10 w-10 rounded-lg bg-gradient-primary opacity-90 transition group-hover:opacity-100" />
              <div className="font-display text-lg">{f.t}</div>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* PLATFORMS */}
      <section id="platforms" className="relative mx-auto max-w-7xl px-6 py-16">
        <div className="glass rounded-3xl p-8 md:p-12">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Integrations</div>
              <h3 className="mt-3 font-display text-3xl md:text-4xl">
                Native APIs. <span className="text-gradient">Zero CSV exports.</span>
              </h3>
              <p className="mt-4 text-muted-foreground">
                Direct integrations with Meta Graph API, TikTok Business, YouTube Data,
                LinkedIn Marketing and the X v2 API. OAuth in one click, refresh forever.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {platforms.map((p) => (
                <div key={p.n} className="glass aspect-square rounded-2xl p-4 flex flex-col justify-between">
                  <span className="h-3 w-3 rounded-full" style={{ background: p.c }} />
                  <span className="text-sm">{p.n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="relative mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pricing</div>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">Simple plans, ridiculous value.</h2>
          <p className="mt-3 text-muted-foreground">Start free. Upgrade when your audience does.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {pricing.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl p-6 ${p.featured ? "bg-gradient-primary text-background shadow-glow" : "glass"}`}
            >
              {p.featured && (
                <span className="absolute right-4 top-4 rounded-full bg-background/20 px-2 py-0.5 text-[10px] font-medium">
                  Most popular
                </span>
              )}
              <div className="font-display text-lg">{p.name}</div>
              <div className={`mt-1 text-sm ${p.featured ? "text-background/80" : "text-muted-foreground"}`}>{p.blurb}</div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-5xl">${p.price}</span>
                <span className={`text-sm ${p.featured ? "text-background/80" : "text-muted-foreground"}`}>/mo</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                {p.features.map((ft) => (
                  <li key={ft} className="flex items-start gap-2">
                    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {ft}
                  </li>
                ))}
              </ul>
              <Link
                to="/dashboard"
                className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition ${
                  p.featured ? "bg-background text-foreground hover:opacity-90" : "border border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="relative mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.a} className="glass rounded-2xl p-6">
              <blockquote className="text-sm leading-relaxed text-foreground/90">“{t.q}”</blockquote>
              <figcaption className="mt-5 text-xs text-muted-foreground">
                <span className="text-foreground">{t.a}</span> · {t.r}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-7xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-10 text-background shadow-glow md:p-16">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/30 blur-3xl" />
          <h3 className="relative font-display text-3xl md:text-5xl">Ship the content that actually grows.</h3>
          <p className="relative mt-3 max-w-xl text-background/80">Connect your accounts in 60 seconds. Free forever for solo creators.</p>
          <Link to="/dashboard" className="relative mt-8 inline-flex rounded-full bg-background px-6 py-3 text-sm font-medium text-foreground hover:opacity-90">
            Open the dashboard
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
          <Brand />
          <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} SocialVerse Analytics. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
