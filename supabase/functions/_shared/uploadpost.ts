import { encryptToken } from "./crypto.ts";

export const UPLOADPOST_SCOPE = "socialverse:upload-post";
export interface UploadPostBinding { userId: string; brandId: string; profile: string; pageId: string }

// Only server configuration can bind an existing provider profile to a tenant.
// Never accept a provider profile name or destination from the browser.
export function uploadPostBinding(userId: string, brandId: string | null): UploadPostBinding | null {
  const bindings = JSON.parse(Deno.env.get("UPLOAD_POST_LINKEDIN_BINDINGS") || "[]") as UploadPostBinding[];
  if (!Array.isArray(bindings)) throw new Error("Invalid LinkedIn provider configuration");
  const matches = bindings.filter(b => b.userId === userId && b.brandId === brandId);
  if (!matches.length) return null;
  const binding = matches[0];
  if (matches.length !== 1 || !/^[\w@-]+$/.test(binding.profile) || !/^urn:li:organization:\d+$/.test(binding.pageId)) {
    throw new Error("Invalid LinkedIn provider binding");
  }
  return binding;
}

async function providerGet(path: string) {
  const key = Deno.env.get("UPLOAD_POST_API_KEY");
  if (!key) throw new Error("LinkedIn Page provider is not configured");
  const response = await fetch(`https://api.upload-post.com${path}`, {
    headers: { Authorization: `Apikey ${key}` }, signal: AbortSignal.timeout(15000), redirect: "error",
  });
  if (!response.ok) throw new Error(`LinkedIn Page provider could not verify this connection (${response.status}). Reconnect in Upload-Post or contact your administrator.`);
  const data = await response.json();
  if (data.success !== true) throw new Error("LinkedIn Page provider did not confirm this connection");
  return data;
}

export async function verifiedUploadPostPage(binding: UploadPostBinding) {
  const data = await providerGet(`/api/uploadposts/users/${encodeURIComponent(binding.profile)}`);
  const member = data.profile?.social_accounts?.linkedin;
  if (data.profile?.username !== binding.profile || !member?.username || member.reauth_required) {
    throw new Error("Reconnect this brand's LinkedIn account in Upload-Post first");
  }
  const selection = await providerGet(`/api/uploadposts/users/linkedin-page?profile_username=${encodeURIComponent(binding.profile)}`);
  const page = selection.pages?.find((p: { id: string }) => p.id === binding.pageId);
  if (!page || selection.selected_page_id !== binding.pageId) {
    throw new Error("The provider's selected LinkedIn Page changed. Select this brand's Page in Upload-Post before reconnecting.");
  }
  return { page, memberId: member.username as string };
}

export async function uploadPostConnectionRow(binding: UploadPostBinding) {
  const { page, memberId } = await verifiedUploadPostPage(binding);
  // Store a routing reference, not the global provider API key, in existing
  // encrypted credential columns. Existing confirmation RPC remains atomic.
  const enc = await encryptToken(JSON.stringify({ provider: "upload-post", ...binding, memberId }));
  return {
    user_id: binding.userId, brand_id: binding.brandId, platform: "linkedin_page",
    platform_user_id: page.id, platform_username: page.vanityName ?? null,
    platform_display_name: page.name, profile_picture_url: page.picture ?? null,
    access_token_ciphertext: enc.ciphertext, token_iv: enc.iv,
    refresh_token_ciphertext: null, refresh_iv: null,
    page_access_token_ciphertext: null, page_access_token_iv: null,
    token_expires_at: null, scopes: [UPLOADPOST_SCOPE], is_active: true,
    followers_count: Number.isFinite(page.followers) ? page.followers : 0,
    following_count: 0, posts_count: 0,
  };
}
