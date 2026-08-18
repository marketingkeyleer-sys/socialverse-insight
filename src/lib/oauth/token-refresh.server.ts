// Shared token access/refresh logic used by both the read-only analytics
// fetchers and the publish adapters — kept in one place so refresh behavior
// (currently: YouTube only, others are long-lived) stays consistent.
import { decryptToken, encryptToken } from "@/lib/oauth/crypto.server";
import type { PlatformId } from "@/lib/oauth/providers.server";

export type ConnectedAccountRow = {
  id: string;
  user_id: string;
  platform: PlatformId;
  provider_account_id: string;
  account_handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  token_iv: string;
  refresh_iv: string | null;
  scopes: string[];
  expires_at: string | null;
  connected_at: string;
  meta: Record<string, unknown>;
};

export async function usableAccessToken(account: ConnectedAccountRow) {
  const accessToken = await decryptToken(account.access_token_ciphertext, account.token_iv);
  const expiresAt = account.expires_at ? new Date(account.expires_at).getTime() : null;
  if (account.platform !== "youtube" || !expiresAt || expiresAt > Date.now() + 120_000)
    return accessToken;
  if (!account.refresh_token_ciphertext || !account.refresh_iv) return accessToken;

  const refreshToken = await decryptToken(account.refresh_token_ciphertext, account.refresh_iv);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return accessToken;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenJson: { access_token?: string; expires_in?: number } = await tokenRes
    .json()
    .catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) return accessToken;

  const encrypted = await encryptToken(tokenJson.access_token);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("connected_accounts")
    .update({
      access_token_ciphertext: encrypted.ciphertext,
      token_iv: encrypted.iv,
      expires_at: tokenJson.expires_in
        ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
        : account.expires_at,
    })
    .eq("id", account.id);
  return tokenJson.access_token as string;
}
