// Public OAuth callback for all platforms. The state we issued maps back to the user.
// Exchanges code for tokens, persists encrypted, then redirects to /connections.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getProvider, getProviderCreds, callbackUrl, type PlatformId } from "@/lib/oauth/providers.server";
import { encryptToken } from "@/lib/oauth/crypto.server";

function redirect(origin: string, path: string) {
  return new Response(null, { status: 302, headers: { Location: `${origin}${path}` } });
}

async function handle(request: Request, platform: PlatformId) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");

  if (errParam) return redirect(origin, `/connections?error=${encodeURIComponent(errParam)}`);
  if (!code || !state) return redirect(origin, "/connections?error=missing_code_or_state");

  // Load + delete state (single-use)
  const { data: row, error: stateErr } = await supabaseAdmin
    .from("oauth_states")
    .select("*")
    .eq("state", state)
    .maybeSingle();
  if (stateErr || !row) return redirect(origin, "/connections?error=invalid_state");
  if (row.platform !== platform) return redirect(origin, "/connections?error=platform_mismatch");
  if (new Date(row.expires_at).getTime() < Date.now())
    return redirect(origin, "/connections?error=state_expired");
  await supabaseAdmin.from("oauth_states").delete().eq("state", state);

  const provider = getProvider(platform);
  const { clientId, clientSecret } = getProviderCreds(provider);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl(origin, platform),
    client_id: clientId,
  });
  if (provider.pkce && row.code_verifier) body.set("code_verifier", row.code_verifier);

  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (provider.tokenAuth === "basic") {
    headers.Authorization = "Basic " + btoa(`${clientId}:${clientSecret}`);
  } else {
    body.set("client_secret", clientSecret);
  }

  const tokenRes = await fetch(provider.tokenUrl, { method: "POST", headers, body });
  const tokenJson: any = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) {
    console.error(`[oauth] ${platform} token exchange failed`, tokenRes.status, tokenJson);
    return redirect(origin, `/connections?error=token_exchange_failed`);
  }

  const accessToken: string = tokenJson.access_token;
  const refreshToken: string | undefined = tokenJson.refresh_token;
  const expiresIn: number | undefined = tokenJson.expires_in;
  const scopes: string[] = (tokenJson.scope || provider.scopes || "")
    .split(/[\s,]+/)
    .filter(Boolean);

  let profile: { id: string; handle?: string; name?: string; avatar?: string } = { id: "me" };
  try {
    if (provider.userInfo) profile = await provider.userInfo(accessToken);
  } catch (e) {
    console.warn(`[oauth] ${platform} userinfo failed`, e);
  }

  const access = await encryptToken(accessToken);
  const refresh = refreshToken ? await encryptToken(refreshToken) : null;

  const { error: upsertErr } = await supabaseAdmin
    .from("connected_accounts")
    .upsert(
      {
        user_id: row.user_id,
        platform,
        provider_account_id: profile.id,
        account_handle: profile.handle ?? null,
        display_name: profile.name ?? null,
        avatar_url: profile.avatar ?? null,
        access_token_ciphertext: access.ciphertext,
        token_iv: access.iv,
        refresh_token_ciphertext: refresh?.ciphertext ?? null,
        refresh_iv: refresh?.iv ?? null,
        scopes,
        expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
        meta: { token_type: tokenJson.token_type ?? null },
      },
      { onConflict: "user_id,platform,provider_account_id" },
    );
  if (upsertErr) {
    console.error(`[oauth] persist failed`, upsertErr);
    return redirect(origin, "/connections?error=persist_failed");
  }

  return redirect(origin, `${row.redirect_to || "/connections"}?connected=${platform}`);
}

export const Route = createFileRoute("/api/oauth/$platform/callback")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const allowed = new Set(["instagram", "facebook", "linkedin", "youtube", "tiktok", "x"]);
        if (!allowed.has(params.platform)) return new Response("Unknown platform", { status: 404 });
        return handle(request, params.platform as PlatformId);
      },
    },
  },
});
