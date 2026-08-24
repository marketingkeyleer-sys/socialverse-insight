import { createFileRoute, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "motion/react";
import { z } from "zod";
import { Instagram, Facebook, Linkedin, Youtube, ChevronDown, CheckCircle2, AlertCircle } from "lucide-react";
import { Brand } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { listConnectedAccounts, disconnectAccount } from "@/lib/oauth/accounts.functions";
import { getOAuthDebugDetails, startOAuth } from "@/routes/api/oauth/start";
import { listFacebookPages, selectFacebookPage } from "@/lib/facebook-pages.functions";

const platforms = [
  { id: "instagram", name: "Instagram", color: "var(--pink)", icon: Instagram },
  { id: "facebook", name: "Facebook", color: "var(--violet)", icon: Facebook },
  { id: "linkedin", name: "LinkedIn", color: "var(--cyan)", icon: Linkedin },
  { id: "youtube", name: "YouTube", color: "var(--destructive)", icon: Youtube },
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

function FacebookPagePicker() {
  const qc = useQueryClient();
  const list = useServerFn(listFacebookPages);
  const select = useServerFn(selectFacebookPage);

  const { data, isLoading } = useQuery({
    queryKey: ["facebook-pages"],
    queryFn: () => list(),
  });

  const selectMut = useMutation({
    mutationFn: (pageId: string) => select({ data: { pageId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["facebook-pages"] }),
  });

  if (isLoading) return null;
  const pages = data?.pages ?? [];
  if (pages.length <= 1) return null;

  return (
    <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3 text-xs">
      <span className="text-muted-foreground">Posting to Page</span>
      <select
        value={data?.selectedPageId ?? pages[0]?.id}
        onChange={(e) => selectMut.mutate(e.target.value)}
        disabled={selectMut.isPending}
        className="rounded-md border border-input bg-transparent px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {pages.map((page) => (
          <option key={page.id} value={page.id} className="bg-background">
            {page.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function ConnectionsPage() {
  const search = useSearch({ from: "/connections" });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const list = useServerFn(listConnectedAccounts);
  const disconnect = useServerFn(disconnectAccount);
  const start = useServerFn(startOAuth);
  const getDebugDetails = useServerFn(getOAuthDebugDetails);

  const [pendingPlatform, setPendingPlatform] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: () => list(),
  });

  const { data: oauthDebug } = useQuery({
    queryKey: ["oauth-debug", window.location.origin],
    queryFn: () => getDebugDetails({ data: { origin: window.location.origin } }),
  });

  const debugByPlatform = new Map((oauthDebug?.items ?? []).map((item) => [item.platform, item]));
  const isConfigured = (platformId: string) => debugByPlatform.get(platformId)?.clientId !== "Not configured";
  const anyUnconfigured = platforms.some((p) => !isConfigured(p.id));

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
      setConnectError(null);

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
      setConnectError(e instanceof Error ? e.message : "Failed to start OAuth flow");
      setShowSetup(true);
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
            One click connects each account — sign in, approve access, done. Tokens are
            encrypted at rest and only your account can use them.
          </p>
        </motion.div>

        {search.connected && (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
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

        {connectError && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div>{connectError}</div>
                <div className="mt-1 text-xs text-red-300/80">
                  This platform's developer credentials aren't set up yet — see "Set up
                  platform credentials" below.
                </div>
              </div>
            </div>
          </div>
        )}

        {anyUnconfigured && !connectError && (
          <div className="mt-6 rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber">
            Some platforms need one-time developer setup before you can connect them. Open
            "Set up platform credentials" below for exact steps.
          </div>
        )}

        <div className="mt-10 grid gap-3 md:grid-cols-2">
          {platforms.map((p) => {
            const connected = connectedByPlatform.get(p.id);
            const configured = isConfigured(p.id);
            const Icon = p.icon;

            return (
              <div
                key={p.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white"
                    style={{ background: p.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {p.name}
                      {!configured && !isLoading && (
                        <span className="rounded-full bg-amber/10 px-2 py-0.5 text-[10px] font-medium text-amber">
                          Setup required
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isLoading
                        ? "Loading..."
                        : connected
                        ? `Connected as ${connected.display_name ?? connected.account_handle ?? "your account"}`
                        : configured
                        ? "Not connected"
                        : "Developer credentials not configured yet"}
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
                    onClick={() => (configured ? connect(p.id) : setShowSetup(true))}
                    disabled={pendingPlatform === p.id}
                    className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-white disabled:opacity-60"
                  >
                    {pendingPlatform === p.id ? "Redirecting..." : configured ? "Connect" : "View setup steps"}
                  </button>
                )}
                </div>
                {p.id === "facebook" && connected && <FacebookPagePicker />}
              </div>
            );
          })}
        </div>

        <section className="mt-10 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <button
            onClick={() => setShowSetup((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <h2 className="text-sm font-semibold text-foreground">Set up platform credentials</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                One-time setup per platform, done by the app owner — not something each user repeats.
              </p>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showSetup ? "rotate-180" : ""}`} />
          </button>

          {showSetup && (
            <div className="mt-5 grid gap-3">
              <div className="rounded-xl border border-white/5 bg-background/40 p-4 text-xs text-muted-foreground">
                Each platform requires its own developer app before "Connect" will work — this
                mirrors how Zoho Social, Buffer, or Hootsuite work under the hood; they've simply
                already done this step for their own app. Register one app per platform below, then
                set its client ID/secret as environment variables in your deployment (and locally in
                <code className="mx-1 rounded bg-white/10 px-1 py-0.5">.env</code> for testing).
              </div>
              {(oauthDebug?.items ?? []).map((item) => (
                <div key={item.platform} className="rounded-xl border border-white/5 bg-background/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">{item.provider}</div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        item.clientId === "Not configured" ? "bg-amber/10 text-amber" : "bg-lime/10 text-lime"
                      }`}
                    >
                      {item.clientId === "Not configured" ? "Not configured" : "Configured"}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-3 text-xs md:grid-cols-[140px_1fr]">
                    <dt className="text-muted-foreground">Env vars needed</dt>
                    <dd className="break-all font-mono">
                      {item.platform === "youtube"
                        ? "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET"
                        : item.platform === "linkedin"
                        ? "LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET"
                        : "META_CLIENT_ID, META_CLIENT_SECRET"}
                    </dd>

                    <dt className="text-muted-foreground">client_id (current)</dt>
                    <dd className="break-all font-mono">{item.clientId}</dd>

                    <dt className="text-muted-foreground">Redirect URI to whitelist</dt>
                    <dd className="break-all font-mono">{item.redirectUri}</dd>

                    <dt className="text-muted-foreground">Scopes requested</dt>
                    <dd className="break-all font-mono">{item.scopes}</dd>
                  </dl>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
