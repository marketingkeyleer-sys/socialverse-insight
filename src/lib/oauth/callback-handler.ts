type PlatformId = "instagram" | "facebook" | "linkedin" | "youtube" | "tiktok" | "x";

function redirect(origin: string, path: string) {
  return new Response(null, { status: 302, headers: { Location: `${origin}${path}` } });
}

export async function handleOAuthCallback(request: Request, platform: PlatformId) {
  const [{ supabaseAdmin }, { getProvider, getProviderCreds, callbackUrl }, { encryptToken }] =
    await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/oauth/providers.server"),
      import("@/lib/oauth/crypto.server"),
    ]);
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");
  const errDescription = url.searchParams.get("error_description") || url.searchParams.get("error_message");

  if (errParam) {
    const message = errDescription ? `${errParam}: ${errDescription}` : errParam;
    return redirect(origin, `/connections?error=${encodeURIComponent(message)}&platform=${platform}`);
  }
  if (!code || !state) return redirect(origin, `/connections?error=missing_code_or_state&platform=${platform}`);

  const { data: row, error: stateErr } = await supabaseAdmin
    .from("oauth_states")
    .select("*")
    .eq("state", state)
    .maybeSingle();
  if (stateErr || !row) return redirect(origin, `/connections?error=invalid_state&platform=${platform}`);
  if (row.platform !== platform) return redirect(origin, `/connections?error=platform_mismatch&platform=${platform}`);
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return redirect(origin, `/connections?error=state_expired&platform=${platform}`);
  }
  await supabaseAdmin.from("oauth_states").delete().eq("state", state);

  const provider = getProvider(platform);
  const { clientId, clientSecret } = getProviderCreds(provider);
  const redirectUri = callbackUrl(origin, platform);
  console.info("[oauth] callback token exchange redirect_uri", {
    provider: provider.name,
    platform,
    redirect_uri: redirectUri,
    callback_url: redirectUri,
  });
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
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
    const details = tokenJson.error_description || tokenJson.error?.message || tokenJson.error || "token_exchange_failed";
    return redirect(origin, `/connections?error=${encodeURIComponent(String(details))}`);
  }

  const accessToken: string = tokenJson.access_token;
  const refreshToken: string | undefined = tokenJson.refresh_token;
  const expiresIn: number | undefined = tokenJson.expires_in;
  const scopes: string[] = (tokenJson.scope || provider.scopes || "").split(/[\s,]+/).filter(Boolean);

  let profile: { id: string; handle?: string; name?: string; avatar?: string } = { id: "me" };
  try {
    if (provider.userInfo) profile = await provider.userInfo(accessToken);
  } catch (e) {
    console.warn(`[oauth] ${platform} userinfo failed`, e);
  }

  const access = await encryptToken(accessToken);
  const refresh = refreshToken ? await encryptToken(refreshToken) : null;

  const { error: upsertErr } = await supabaseAdmin.from("connected_accounts").upsert(
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