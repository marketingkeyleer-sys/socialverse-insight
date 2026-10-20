import { Link } from "react-router-dom";
import { BarChart3, Check, Clock, Layers, Menu, Moon, Sun, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { APP_NAME, PLAN_LIMITS } from "@/lib/constants";
import { PLATFORM_CONFIGS } from "@/lib/platforms";

const FEATURES = [
  { icon: Layers, title: "Multi-platform posting", description: "Compose once, publish everywhere — Facebook, Instagram, YouTube, and LinkedIn, all from a single editor." },
  { icon: BarChart3, title: "Analytics dashboard", description: "Followers, reach, engagement, and top posts, unified across every channel you manage." },
  { icon: Clock, title: "Schedule & automate", description: "Queue up content ahead of time and let it publish itself, right down to the minute." },
  { icon: Users, title: "Built for teams", description: "Invite teammates, assign roles, and keep everyone posting from the same source of truth." },
];

const STEPS = [
  { number: "01", title: "Sign up", description: "Create your free account in under a minute — no credit card required." },
  { number: "02", title: "Connect your accounts", description: "Link Facebook, Instagram, YouTube, and LinkedIn in a couple of clicks." },
  { number: "03", title: "Start posting", description: "Compose, schedule, and track performance from one clean dashboard." },
];

const TESTIMONIALS = [
  { quote: "We replaced three separate tools with SocialVerse. Our team finally has one place to plan and post.", name: "Maya R.", role: "Marketing Lead" },
  { quote: "Scheduling used to eat my whole Monday. Now it takes fifteen minutes.", name: "Devon K.", role: "Freelance Creator" },
  { quote: "The analytics view is the first dashboard our whole team actually opens every week.", name: "Priya S.", role: "Social Media Manager" },
];

export default function Landing() {
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link to="/" className="text-lg font-semibold tracking-tight hover:opacity-80">
            {APP_NAME}
          </Link>

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
      <section className="relative overflow-hidden px-4 py-20 md:px-6 md:py-28">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,theme(colors.primary/12%),transparent_60%)]" />
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Manage all your social media in one place
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Schedule posts, track analytics, and grow your audience — one dashboard for Facebook, Instagram, YouTube & LinkedIn.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/signup">Get started free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            {PLATFORM_CONFIGS.map((p) => (
              <span key={p.id} className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ backgroundColor: p.color }}>
                <p.icon className="h-5 w-5" />
              </span>
            ))}
          </div>
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
                    <Link to="/signup">{tier === "free" ? "Start free" : tier === "pro" ? "Start 14-day trial" : "Talk to sales"}</Link>
                  </Button>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t bg-muted/30 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl grid gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-2xl border bg-card p-6">
              <p className="text-sm">"{t.quote}"</p>
              <p className="mt-4 text-sm font-medium">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t px-4 py-20 text-center md:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">Ready to bring every channel into one view?</h2>
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
