// JWT-protected: starts the OAuth flow for a given platform.
// Returns the provider authorize URL the client should navigate to.
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getProvider, getProviderCreds, callbackUrl, type PlatformId } from "@/lib/oauth/providers.server";
import { randomString, pkceChallenge } from "@/lib/oauth/crypto.server";

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
    const provider = getProvider(data.platform);
    const { clientId } = getProviderCreds(provider);

    const state = randomString(32);
    let codeVerifier: string | null = null;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl(data.origin, data.platform as PlatformId),
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

    // Persist state via service role (RLS would also allow user, but admin keeps it simple).
    const { error } = await supabaseAdmin.from("oauth_states").insert({
      state,
      user_id: context.userId,
      platform: data.platform,
      code_verifier: codeVerifier,
      redirect_to: data.redirectTo ?? "/dashboard",
    });
    if (error) throw new Error(`Failed to persist OAuth state: ${error.message}`);

    return { authorizeUrl: `${provider.authorizeUrl}?${params.toString()}` };
  });

// Tiny shim route so TanStack registers something at this path (we only use the serverFn).
export const Route = createFileRoute("/api/oauth/start")({
  server: {
    handlers: {
      GET: async () => new Response("Use POST via server function", { status: 405 }),
    },
  },
});
