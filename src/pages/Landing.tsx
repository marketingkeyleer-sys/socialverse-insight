import { Link } from "react-router-dom";
import { BarChart3, Check, Clock, Layers, Menu, Moon, Sun, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { APP_NAME, PLAN_LIMITS } from "@/lib/constants";
import { PLATFORM_CONFIGS, PLATFORM_DETAILS } from "@/lib/platforms";

const FEATURES = [
  { icon: Layers, title: "A voice for every platform", description: "Tailor captions and media to each channel, with a separate preview before publishing." },
  { icon: BarChart3, title: "Clarity for every company", description: "Keep followers, performance and content in the right brand workspace." },
  { icon: Clock, title: "Schedule & automate", description: "Queue up content ahead of time and let it publish itself, right down to the minute." },
  { icon: Users, title: "Multiple brands, organized", description: "Switch between companies without mixing their channels, posts or audience counts." },
];

const STEPS = [
  { number: "01", title: "Sign up", description: "Create your free account in under a minute — no credit card required." },
  { number: "02", title: "Create a brand workspace", description: "Give each company its own space and connect the accounts you are authorized to manage." },
  { number: "03", title: "Create with purpose", description: "Choose a brand, tailor each platform's content, and track its own results." },
];


export default function Landing() {
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link to="/" className="hover:opacity-80"><span className="text-lg font-bold tracking-tight">{APP_NAME}<span className="text-primary">.</span></span><span className="hidden text-[10px] tracking-wide text-muted-foreground sm:block">A workspace for every brand</span></Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme" className="hidden sm:inline-flex">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Get started free</Link>
            </Button>
            <button className="grid h-9 w-9 place-items-center rounded-md md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm md:hidden">
            <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
            <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
            <Link to="/login" onClick={() => setMenuOpen(false)}>Sign in</Link>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background px-4 py-20 md:px-6 md:py-24">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,theme(colors.primary/12%),transparent_60%)]" />
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-6 inline-flex rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-semibold tracking-widest text-primary">YOUR BRANDS. BEAUTIFULLY ORGANIZED.</p>
          <h1 className="text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl md:text-6xl">Every brand has a voice.<br /><span className="text-primary">Give yours room to grow.</span></h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Separate workspaces for every company. Thoughtful content for every platform. Clear insights from the channels you actually manage.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/signup">Get started free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>
          <div className="mt-12 grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3" aria-label="Social platform integrations">
            {PLATFORM_CONFIGS.map((p) => (
              <a key={p.id} href={PLATFORM_DETAILS[p.id].website} target="_blank" rel="noreferrer" aria-label={`Visit ${p.label}`} className="rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ backgroundColor: p.id === "instagram" ? undefined : p.color, backgroundImage: p.id === "instagram" ? "linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)" : undefined }}><p.icon className="h-5 w-5" /></span><span className="mt-3 block text-sm font-semibold">{p.label}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{PLATFORM_DETAILS[p.id].caption}</span></a>
            ))}
          </div>
          <p className="mt-5 text-xs text-muted-foreground">Connect accounts you own or manage. Available features depend on each platform's permissions.</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Built for the way modern teams actually grow</h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t bg-muted/30 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.number} className="text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                  {step.number}
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Simple plans, ridiculous value</h2>
            <p className="mt-2 text-muted-foreground">Start free. Upgrade when your audience does.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {(Object.entries(PLAN_LIMITS) as [keyof typeof PLAN_LIMITS, (typeof PLAN_LIMITS)[keyof typeof PLAN_LIMITS]][]).map(
              ([tier, plan]) => (
                <div key={tier} className={`rounded-2xl border p-6 ${tier === "pro" ? "border-primary shadow-lg" : ""}`}>
                  {tier === "pro" && (
                    <span className="mb-3 inline-block rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                      Most popular
                    </span>
                  )}
                  <h3 className="font-semibold">{plan.label}</h3>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">{plan.priceLabel}</p>
                  <ul className="mt-5 space-y-2.5 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="mt-6 w-full" variant={tier === "pro" ? "default" : "outline"}>
                    <Link to="/signup">{tier === "free" ? "Start free" : tier === "pro" ? "Choose Pro" : "Choose Business"}</Link>
                  </Button>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="border-y bg-primary/5 px-4 py-14 md:px-6"><div className="mx-auto grid max-w-6xl gap-7 md:grid-cols-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">01 / Organize</p><h2 className="mt-3 text-xl font-semibold">One company, one workspace</h2><p className="mt-2 text-sm text-muted-foreground">A brand is your company or client. Its connected accounts stay together.</p></div><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">02 / Create</p><h2 className="mt-3 text-xl font-semibold">Content that fits the channel</h2><p className="mt-2 text-sm text-muted-foreground">A LinkedIn update and an Instagram story deserve different words and media.</p></div><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">03 / Understand</p><h2 className="mt-3 text-xl font-semibold">Real data, clearly presented</h2><p className="mt-2 text-sm text-muted-foreground">See each channel's followers, recent activity and available analytics separately.</p></div></div></section>

      {/* Final CTA */}
      <section className="border-t px-4 py-20 text-center md:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">Ready to give every brand its own space?</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">Free forever for solo creators — no credit card required.</p>
        <Button size="lg" asChild className="mt-6">
          <Link to="/signup">Get started free</Link>
        </Button>
      </section>

      <footer className="border-t px-4 py-10 md:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <Link to="/" className="font-semibold text-foreground hover:opacity-80">
            {APP_NAME}
          </Link>
          <div className="flex gap-6">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <Link to="/login" className="hover:text-foreground">Sign in</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
          </div>
          <span>© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
