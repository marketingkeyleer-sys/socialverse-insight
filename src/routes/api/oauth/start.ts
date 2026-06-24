// JWT-protected: starts the OAuth flow for a given platform.
// Returns the provider authorize URL the client should navigate to.
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      platform: z.enum(["instagram", "facebook", "linkedin", "youtube", "tiktok", "x"]),
      origin: z.string().url(),
      redirectTo: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const [{ supabaseAdmin }, { getProvider, getProviderCreds, callbackUrl }, { randomString, pkceChallenge }] =
      await Promise.all([
        import("@/integrations/supabase/client.server"),
        import("@/lib/oauth/providers.server"),
        import("@/lib/oauth/crypto.server"),
      ]);
    const provider = getProvider(data.platform);
    const { clientId } = getProviderCreds(provider);
    const redirectUri = callbackUrl(data.origin, data.platform);
    const safeRedirectTo = data.redirectTo?.startsWith("/") && !data.redirectTo.startsWith("//")
      ? data.redirectTo
      : "/dashboard";

    const state = randomString(32);
    let codeVerifier: string | null = null;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: provider.scopes,
      state,
    });

    if (provider.pkce) {
      codeVerifier = randomString(48);
      const challenge = await pkceChallenge(codeVerifier);
      params.set("code_challenge", challenge);
      params.set("code_challenge_method", "S256");
    }
    if (provider.extraAuthParams) {
      for (const [k, v] of Object.entries(provider.extraAuthParams)) params.set(k, v);
    }

    console.info("[oauth] authorization redirect_uri generated", {
      provider: provider.name,
      platform: data.platform,
      redirect_uri: redirectUri,
      callback_url: redirectUri,
      scopes: provider.scopes,
    });

    // Persist state via service role (RLS would also allow user, but admin keeps it simple).
    const { error } = await supabaseAdmin.from("oauth_states").insert({
      state,
      user_id: context.userId,
      platform: data.platform,
      code_verifier: codeVerifier,
      redirect_to: safeRedirectTo,
    });
    if (error) throw new Error(`Failed to persist OAuth state: ${error.message}`);

    return {
      authorizeUrl: `${provider.authorizeUrl}?${params.toString()}`,
      debug: {
        provider: provider.name,
        platform: data.platform,
        clientId,
        redirectUri,
        scopes: provider.scopes,
        callbackUrl: redirectUri,
      },
    };
  });

export const getOAuthDebugDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ origin: z.string().url() }).parse(input))
  .handler(async ({ data }) => {
    const { getProvider, callbackUrl } = await import("@/lib/oauth/providers.server");
    const platforms = ["facebook", "instagram", "linkedin", "youtube"] as const;

    return {
      items: platforms.map((platform) => {
        const provider = getProvider(platform);
        const redirectUri = callbackUrl(data.origin, platform);
        return {
          provider: provider.name,
          platform,
          clientId: process.env[provider.clientIdEnv] || "Not configured",
          redirectUri,
          scopes: provider.scopes,
          callbackUrl: redirectUri,
        };
      }),
    };
  });

// Tiny shim route so TanStack registers something at this path (we only use the serverFn).
export const Route = createFileRoute("/api/oauth/start")({
  server: {
    handlers: {
      GET: async () => new Response("Use POST via server function", { status: 405 }),
    },
  },
});
