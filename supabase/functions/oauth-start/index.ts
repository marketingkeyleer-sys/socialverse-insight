// Authenticated: given a platform + the app's own origin, builds that
// platform's authorize URL and stashes a one-time state row so
// oauth-callback can tie the redirect back to this user.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { callbackUrl, getProvider, getProviderCreds } from "../_shared/providers.ts";
import { pkceChallenge, randomString } from "../_shared/crypto.ts";
import { safeRedirect } from "../_shared/oauth-policy.ts";
import { uploadPostBinding, uploadPostConnectionRow } from "../_shared/uploadpost.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method !== "POST") throw new Error("Use POST");
    const { platform, redirectTo, brandId } = await req.json();
    const appUrl = Deno.env.get("APP_URL");
    if (!appUrl) throw new Error("APP_URL must be configured on the server");
    const returnUrl = safeRedirect(redirectTo, appUrl, Deno.env.get("OAUTH_ALLOWED_ORIGINS"));
    if (platform === "linkedin_page") {
      const binding = uploadPostBinding(userData.user.id, brandId ?? null);
      if (binding) {
        const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data: brand, error: brandError } = await admin.from("sv_brands").select("id")
          .eq("id", binding.brandId).eq("user_id", userData.user.id).maybeSingle();
        if (brandError || !brand) throw new Error("Brand not found");
        const row = await uploadPostConnectionRow(binding);
        const { data: pending, error } = await admin.from("sv_oauth_pending").insert({
          user_id: userData.user.id, platform, brand_id: binding.brandId, accounts: [row],
        }).select("id").single();
        if (error || !pending) throw new Error("Could not prepare the LinkedIn Page connection");
        const destination = new URL("/accounts", returnUrl);
        destination.searchParams.set("connection_request", pending.id);
        return new Response(JSON.stringify({ authorizeUrl: destination.toString() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    let provider = getProvider(platform);
    if (platform === "facebook" || platform === "instagram") {
      // Reconnecting an existing publishing/inbox account must not silently
      // replace its broader consent with connection-only consent. This read
      // uses the signed-in user's client and explicit ownership filtering.
      const { data: accounts, error: accountError } = await userClient.from("sv_connected_accounts")
        .select("brand_id,scopes").eq("user_id", userData.user.id).eq("platform", platform);
      const basicScopes = new Set(["public_profile", "pages_show_list", "pages_read_engagement", "instagram_basic"]);
      const needsExistingPermissions = accounts?.some((account: { brand_id: string | null; scopes: string[] | null }) =>
        account.brand_id === (brandId ?? null) && account.scopes?.some(scope => !basicScopes.has(scope)));
      if (accountError || needsExistingPermissions) provider = getProvider(platform, { preserveMetaPermissions: true });
    }
    const { clientId } = getProviderCreds(provider);
    const redirectUri = callbackUrl(supabaseUrl, provider.id);

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
      params.set("code_challenge", await pkceChallenge(codeVerifier));
      params.set("code_challenge_method", "S256");
    }
    if (provider.extraAuthParams) {
      for (const [k, v] of Object.entries(provider.extraAuthParams)) params.set(k, v);
    }

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (brandId) {
      const { data: brand } = await admin.from("sv_brands").select("id").eq("id", brandId).eq("user_id", userData.user.id).maybeSingle();
      if (!brand) throw new Error("Brand not found");
    }
    const { error: insertErr } = await admin.from("sv_oauth_states").insert({
      state,
      user_id: userData.user.id,
      platform: provider.id,
      code_verifier: codeVerifier,
      redirect_to: returnUrl,
      brand_id: brandId ?? null,
    });
    if (insertErr) throw new Error(insertErr.message);

    return new Response(
      JSON.stringify({ authorizeUrl: `${provider.authorizeUrl}?${params.toString()}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
