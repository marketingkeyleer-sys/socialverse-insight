// Public (unauthenticated) — this is the redirect target the provider sends
// the browser back to after the user approves/denies access. Path is
// /oauth-callback/<platform>. Verifies state, exchanges code for tokens,
// stores them encrypted, then 302s the browser back into the app.
import { createClient } from "npm:@supabase/supabase-js@2";
import { callbackUrl, getProvider, getProviderCreds, type PlatformId } from "../_shared/providers.ts";
import { encryptToken } from "../_shared/crypto.ts";
import { grantedScopes, safeRedirect } from "../_shared/oauth-policy.ts";

function redirect(to: string, params: Record<string, string>) {
  const url = new URL(to);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const platform = url.pathname.split("/").filter(Boolean).pop() as PlatformId;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Atomic one-time consumption: whoever deletes the row is the only caller
  // that gets to use it, so a replayed callback can't hijack the same state.
  const { data: stateRow } = state
    ? await admin.from("sv_oauth_states").delete().eq("state", state).select().maybeSingle()
    : { data: null };

  const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";
  let redirectTo = `${appUrl}/accounts`;
  try {
    redirectTo = safeRedirect(stateRow?.redirect_to, appUrl, Deno.env.get("OAUTH_ALLOWED_ORIGINS"));
  } catch {
    return redirect(redirectTo, { connect_error: "Invalid return URL. Please reconnect.", platform });
  }

  if (providerError) {
    return redirect(redirectTo, { connect_error: providerError, platform });
  }
  if (!code || !state || !stateRow) {
    return redirect(redirectTo, { connect_error: "Invalid or expired connection request. Please try again.", platform });
  }
  if (new Date(stateRow.expires_at) < new Date()) {
    return redirect(redirectTo, { connect_error: "This connection request expired. Please try again.", platform });
  }
  if (stateRow.platform !== platform) {
    return redirect(redirectTo, { connect_error: "Platform mismatch.", platform });
  }

  try {
    const provider = getProvider(platform);
    const { clientId, clientSecret } = getProviderCreds(provider);
    const redirectUri = callbackUrl(supabaseUrl, provider.id);

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });
    if (stateRow.code_verifier) body.set("code_verifier", stateRow.code_verifier);

    const tokenRes = await fetch(provider.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error(tokenJson.error_description ?? tokenJson.error?.message ?? "Token exchange failed");
    }

    let accessToken: string = tokenJson.access_token;
    const refreshToken: string | undefined = tokenJson.refresh_token;
    let expiresIn: number | undefined = tokenJson.expires_in;
    let scopes = grantedScopes(tokenJson.scope);
    if (platform === "facebook" || platform === "instagram") {
      const exchange = new URL(provider.tokenUrl);
      exchange.search = new URLSearchParams({ grant_type: "fb_exchange_token", client_id: clientId, client_secret: clientSecret, fb_exchange_token: accessToken }).toString();
      const response = await fetch(exchange);
      const longLived = await response.json();
      if (!response.ok || !longLived.access_token) throw new Error("Could not obtain a long-lived Meta token. Check app configuration and reconnect.");
      accessToken = longLived.access_token;
      expiresIn = longLived.expires_in;
      const permissionsResponse = await fetch("https://graph.facebook.com/v21.0/me/permissions", { headers: { Authorization: `Bearer ${accessToken}` } });
      if (permissionsResponse.ok) {
        const permissions = await permissionsResponse.json();
        scopes = (permissions.data ?? []).filter((p: { status: string }) => p.status === "granted").map((p: { permission: string }) => p.permission);
      }
    }

    // One login can unlock several Pages (or several IG accounts, one per
    // Page) — every one of them gets its own row instead of only the first.
    const identities = await provider.userInfo(accessToken);

    const enc = await encryptToken(accessToken);
    const refreshEnc = refreshToken ? await encryptToken(refreshToken) : null;

    const rows = await Promise.all(
      identities.map(async (info) => {
        const pageEnc = info.pageAccessToken ? await encryptToken(info.pageAccessToken) : null;
        return {
          user_id: stateRow.user_id,
          platform: provider.id,
          platform_user_id: info.id,
          platform_username: info.handle ?? null,
          platform_display_name: info.name ?? null,
          access_token_ciphertext: enc.ciphertext,
          token_iv: enc.iv,
          refresh_token_ciphertext: refreshEnc?.ciphertext ?? null,
          refresh_iv: refreshEnc?.iv ?? null,
          page_access_token_ciphertext: pageEnc?.ciphertext ?? null,
          page_access_token_iv: pageEnc?.iv ?? null,
          token_expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
          // Do not represent requested permissions as granted permissions.
          scopes,
          is_active: true,
          profile_picture_url: info.avatar ?? null,
          followers_count: info.followers ?? 0,
          following_count: info.following ?? 0,
          posts_count: info.posts ?? 0,
          last_synced_at: new Date().toISOString(),
          brand_id: stateRow.brand_id ?? null,
        };
      }),
    );

    if (!rows.length) throw new Error("No manageable accounts were authorized.");
    // Encrypted credentials stay server-side until this authenticated user
    // confirms the exact assets they want to connect.
    const { data: pending, error: pendingErr } = await admin.from("sv_oauth_pending")
      .insert({ user_id: stateRow.user_id, platform, brand_id: stateRow.brand_id, accounts: rows })
      .select("id").single();
    if (pendingErr) throw new Error("Could not save the connection request. Ask the application administrator to check the connection storage configuration, then try again.");
    return redirect(`${new URL(redirectTo).origin}/accounts`, { connection_request: pending.id });
  } catch (error) {
    return redirect(redirectTo, {
      connect_error: error instanceof Error ? error.message : String(error),
      platform,
    });
  }
});
