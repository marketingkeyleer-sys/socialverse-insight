import { createFileRoute, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "motion/react";
import { z } from "zod";
import { Brand } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { listConnectedAccounts, disconnectAccount } from "@/lib/oauth/accounts.functions";
import { getOAuthDebugDetails, startOAuth } from "@/routes/api/oauth/start";

const platforms = [
  { id: "instagram", name: "Instagram", color: "var(--pink)" },
  { id: "facebook", name: "Facebook", color: "var(--violet)" },
  { id: "linkedin", name: "LinkedIn", color: "var(--cyan)" },
  { id: "youtube", name: "YouTube", color: "var(--destructive)" },
] as const;

const searchSchema = z.object({
  connected: z.string().optional(),
  error: z.string().optional(),
  platform: z.string().optional(),
});

export const Route = createFileRoute("/connections")({
  validateSearch: searchSchema,
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: ConnectionsPage,
  head: () => ({ meta: [{ title: "Connections · SocialVerse Analytics" }] }),
});

function ConnectionsPage() {
  const search = useSearch({ from: "/connections" });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const list = useServerFn(listConnectedAccounts);
  const disconnect = useServerFn(disconnectAccount);
  const start = useServerFn(startOAuth);
  const getDebugDetails = useServerFn(getOAuthDebugDetails);

  const [pendingPlatform, setPendingPlatform] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: () => list(),
  });

  const { data: oauthDebug } = useQuery({
    queryKey: ["oauth-debug", window.location.origin],
    queryFn: () => getDebugDetails({ data: { origin: window.location.origin } }),
  });

  const disconnectMut = useMutation({
    mutationFn: (id: string) => disconnect({ data: { id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["connections"] });
    },
  });

  const connect = async (platform: typeof platforms[number]["id"]) => {
    // Detect if we're inside an iframe (Lovable preview). Providers like
    // Facebook/Google/LinkedIn send X-Frame-Options: DENY and refuse to load
    // inside a frame — so we must break out to the top window or a new tab.
    const inIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();

    // Open a blank tab SYNCHRONOUSLY before any await, so popup blockers
    // treat it as a user-initiated action.
    const popup = inIframe ? window.open("about:blank", "_blank") : null;

    try {
      setPendingPlatform(platform);

      const res = await start({
        data: {
          platform,
          origin: window.location.origin,
          redirectTo: "/connections",
        },
      });

      if (!res?.authorizeUrl) {
        throw new Error("Missing authorize URL");
      }

      if (inIframe) {
        if (popup && !popup.closed) {
          popup.location.href = res.authorizeUrl;
        } else {
          // Popup blocked — try to escape the iframe by navigating top.
          try {
            window.top!.location.href = res.authorizeUrl;
          } catch {
            window.open(res.authorizeUrl, "_blank", "noopener,noreferrer");
          }
        }
        setPendingPlatform(null);
      } else {
        window.location.assign(res.authorizeUrl);
      }
    } catch (e) {
      popup?.close();
      alert(e instanceof Error ? e.message : "Failed to start OAuth flow");
      setPendingPlatform(null);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const connectedByPlatform = new Map<string, NonNullable<typeof data>["accounts"][number]>();
  data?.accounts.forEach((a) => connectedByPlatform.set(a.platform, a));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Brand />
          <button onClick={signOut} className="text-xs text-muted-foreground hover:text-foreground">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Settings</div>
          <h1 className="mt-2 text-3xl font-semibold">Connected accounts</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Connect each social account once. Tokens are encrypted at rest and only your
            account can use them.
          </p>
        </motion.div>

        {search.connected && (
          <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            Connected {search.connected}.
          </div>
        )}

        {search.error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <span>{search.error}</span>
              {search.platform && platforms.some((p) => p.id === search.platform) && (
                <button
                  onClick={() => connect(search.platform as typeof platforms[number]["id"])}
                  className="rounded-full bg-red-500/20 px-4 py-2 text-xs font-medium text-red-300 hover:bg-red-500/30"
                >
                  Retry {platforms.find((p) => p.id === search.platform)?.name}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-10 grid gap-3 md:grid-cols-2">
          {platforms.map((p) => {
            const connected = connectedByPlatform.get(p.id);

            return (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="h-9 w-9 rounded-xl" style={{ background: p.color }} />
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {isLoading
                        ? "Loading..."
                        : connected
                        ? `Connected as ${connected.display_name ?? connected.account_handle ?? "your account"}`
                        : "Not connected"}
                    </div>
                  </div>
                </div>

                {connected ? (
                  <button
                    onClick={() => disconnectMut.mutate(connected.id)}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs hover:bg-white/10"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => connect(p.id)}
                    disabled={pendingPlatform === p.id}
                    className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-white disabled:opacity-60"
                  >
                    {pendingPlatform === p.id ? "Redirecting..." : "Connect"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <section className="mt-10 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-foreground">OAuth debugging</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Verify these values in each provider developer console.
          </p>

          <div className="mt-5 grid gap-3">
            {(oauthDebug?.items ?? []).map((item) => (
              <div key={item.platform} className="rounded-xl border border-white/5 bg-background/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">{item.provider}</div>
                  <code className="text-[11px] text-muted-foreground">{item.platform}</code>
                </div>
                <dl className="mt-3 grid gap-3 text-xs md:grid-cols-[120px_1fr]">
                  <dt className="text-muted-foreground">client_id</dt>
                  <dd className="break-all font-mono">{item.clientId}</dd>

                  <dt className="text-muted-foreground">redirect_uri</dt>
                  <dd className="break-all font-mono">{item.redirectUri}</dd>

                  <dt className="text-muted-foreground">scopes</dt>
                  <dd className="break-all font-mono">{item.scopes}</dd>

                  <dt className="text-muted-foreground">callback URL</dt>
                  <dd className="break-all font-mono">{item.callbackUrl}</dd>
                </dl>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
