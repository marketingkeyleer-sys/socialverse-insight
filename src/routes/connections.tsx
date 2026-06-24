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
  { id: "tiktok", name: "TikTok", color: "var(--lime)" },
  { id: "x", name: "X / Twitter", color: "var(--amber)" },
] as const;

const searchSchema = z.object({
  connected: z.string().optional(),
  error: z.string().optional(),
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
  const [manualAuthUrl, setManualAuthUrl] = useState<string | null>(null);
  const origin = window.location.origin;

  const { data, isLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: () => list(),
  });

  const { data: oauthDebug } = useQuery({
    queryKey: ["oauth-debug", origin],
    queryFn: () => getDebugDetails({ data: { origin } }),
  });

  const disconnectMut = useMutation({
    mutationFn: (id: string) => disconnect({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  });

  const connect = async (platform: typeof platforms[number]["id"]) => {
    setPendingPlatform(platform);
    setManualAuthUrl(null);
    try {
      const res = await start({
        data: { platform, origin: window.location.origin, redirectTo: "/connections" },
      });

      console.info("[oauth] starting full-browser authorization", res.debug);

      if (window.self !== window.top) {
        const opened = window.open(res.authorizeUrl, "_blank");
        if (!opened) setManualAuthUrl(res.authorizeUrl);
        return;
      }
      window.location.href = res.authorizeUrl;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to start OAuth flow");
    } finally {
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
          <h1 className="mt-2 font-display text-4xl">Connected accounts</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Connect each social account once. Tokens are encrypted at rest and only your
            account can use them — RLS enforces per-user access on the backend.
          </p>
        </motion.div>

        {search.connected && (
          <div className="mt-6 rounded-xl border border-lime/30 bg-lime/10 px-4 py-3 text-sm text-lime">
            ✓ Connected {search.connected}.
          </div>
        )}
        {search.error && (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {search.error}
          </div>
        )}
        {manualAuthUrl && (
          <div className="mt-6 rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber">
            Browser blocked the new OAuth window. Open the authorization flow in a full browser window:{" "}
            <a href={manualAuthUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">
              Continue OAuth
            </a>
          </div>
        )}

        <div className="mt-10 grid gap-3 md:grid-cols-2">
          {platforms.map((p) => {
            const connected = connectedByPlatform.get(p.id);
            return (
              <div key={p.id} className="glass shadow-card flex items-center justify-between rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <span className="h-9 w-9 rounded-xl" style={{ background: p.color }} />
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {isLoading
                        ? "…"
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
                    className="rounded-full bg-gradient-primary px-4 py-2 text-xs font-medium text-background shadow-glow"
                  >
                    {pendingPlatform === p.id ? "Opening…" : "Connect"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <section className="mt-10 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">OAuth debugging</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                These are the exact values generated by SocialVerse for this environment.
              </p>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-muted-foreground">
              Full browser redirect
            </span>
          </div>
          <div className="mt-5 grid gap-3">
            {(oauthDebug?.items ?? []).map((item) => (
              <div key={item.platform} className="rounded-xl border border-white/5 bg-background/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">{item.provider}</div>
                  <code className="text-[11px] text-muted-foreground">{item.platform}</code>
                </div>
                <dl className="mt-3 grid gap-3 text-xs md:grid-cols-[120px_1fr]">
                  <dt className="text-muted-foreground">client_id</dt>
                  <dd className="break-all font-mono text-foreground">{item.clientId}</dd>
                  <dt className="text-muted-foreground">redirect_uri</dt>
                  <dd className="break-all font-mono text-foreground">{item.redirectUri}</dd>
                  <dt className="text-muted-foreground">scopes</dt>
                  <dd className="break-words font-mono text-foreground">{item.scopes}</dd>
                  <dt className="text-muted-foreground">callback URL</dt>
                  <dd className="break-all font-mono text-foreground">{item.callbackUrl}</dd>
                </dl>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10 rounded-2xl border border-white/5 bg-white/[0.02] p-5 text-xs text-muted-foreground">
          <strong className="text-foreground">Heads up:</strong> To complete an OAuth handshake you
          (the app owner) must register your app with each provider's developer portal, add the
          callback URL <code className="text-foreground">/api/public/oauth/{"{platform}"}/callback</code>{" "}
          to its allowed redirects, and store the client ID + secret in this project's secrets
          (e.g. <code>META_CLIENT_ID</code>, <code>META_CLIENT_SECRET</code>,{" "}
          <code>LINKEDIN_CLIENT_ID</code>, etc.). Until those are set, the “Connect” button will
          surface a clear error from the provider.
        </div>
      </main>
    </div>
  );
}
