import { motion } from "motion/react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { ensureCurrentUserProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in · SocialVerse Analytics" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const ensureProfile = useServerFn(ensureCurrentUserProfile);
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        setMessage("Password reset link sent. Check your email and open the link.");
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Account created. Please check your email, then sign in.");
          setMode("signin");
          return;
        }
        await ensureProfile().catch((profileError) => console.warn("Profile sync failed", profileError));
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
        await ensureProfile().catch((profileError) => console.warn("Profile sync failed", profileError));
        navigate({ to: "/dashboard" });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="font-display text-3xl">
            {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset password"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "reset" ? "Enter your account email to receive a reset link." : "Sign in to connect your social accounts."}
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          {message && (
            <div className="mt-4 rounded-lg border border-lime/30 bg-lime/10 px-3 py-2 text-xs text-lime">
              {message}
            </div>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setError(null);
              setMessage(null);
              setLoading(true);
              try {
                const result = await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: window.location.origin,
                });
                if (result.error) throw result.error;
                if (result.redirected) return;
                await ensureProfile().catch((e) => console.warn("Profile sync failed", e));
                navigate({ to: "/connections" });
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Google sign-in failed");
              } finally {
                setLoading(false);
              }
            }}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium hover:bg-white/10 disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.2 5.2C41.1 36 44 30.5 44 24c0-1.3-.1-2.4-.4-3.5z"/>
            </svg>
            Continue with Google
          </button>

          <div className="mt-6 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-white/10" /> or use email <span className="h-px flex-1 bg-white/10" />
          </div>


          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@brand.com"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            {mode !== "reset" && (
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-primary py-3 text-sm font-medium text-background shadow-glow disabled:opacity-60"
            >
              {loading ? "…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </button>
          </form>

          <div className="mt-4 grid gap-2 text-center text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="hover:text-foreground"
            >
              {mode === "signin" ? "No account? Create one" : "Already have an account? Sign in"}
            </button>
            {mode !== "signup" && (
              <button type="button" onClick={() => setMode("reset")} className="hover:text-foreground">
                Forgot password?
              </button>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            After signing in, connect your social accounts from{" "}
            <Link to="/connections" className="text-foreground underline">/connections</Link>.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
