import { motion } from "motion/react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Brand } from "@/components/brand";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in · SocialVerse Analytics" }] }),
});

const providers = [
  { id: "meta", label: "Continue with Meta", c: "var(--violet)" },
  { id: "google", label: "Continue with Google", c: "var(--cyan)" },
  { id: "linkedin", label: "Continue with LinkedIn", c: "var(--cyan)" },
  { id: "tiktok", label: "Continue with TikTok", c: "var(--lime)" },
  { id: "x", label: "Continue with X", c: "var(--amber)" },
];

function LoginPage() {
  const navigate = useNavigate();
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-hero-glow" />
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <Brand className="mb-10" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="glass shadow-card rounded-2xl p-8"
        >
          <h1 className="font-display text-3xl">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to connect your social accounts.
          </p>
          <div className="mt-8 space-y-2">
            {providers.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate({ to: "/dashboard" })}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition hover:bg-white/10"
              >
                <span className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.c }} />
                  {p.label}
                </span>
                <span className="text-muted-foreground">→</span>
              </button>
            ))}
          </div>
          <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="h-px flex-1 bg-white/10" /> or <div className="h-px flex-1 bg-white/10" />
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); navigate({ to: "/dashboard" }); }}
          >
            <input
              type="email"
              placeholder="you@brand.com"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            <button className="w-full rounded-xl bg-gradient-primary py-3 text-sm font-medium text-background shadow-glow">
              Sign in
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            No account? <Link to="/dashboard" className="text-foreground underline">Try the demo dashboard</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
