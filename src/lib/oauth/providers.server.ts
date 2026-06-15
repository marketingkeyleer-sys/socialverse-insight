// Server-only OAuth provider registry.
// Each entry describes how to drive the Authorization-Code flow for one platform.
// Client IDs/secrets are read from environment variables at call-time.

export type PlatformId = "instagram" | "facebook" | "linkedin" | "youtube" | "tiktok" | "x";

export interface ProviderConfig {
  id: PlatformId;
  name: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;
  /** Whether to use PKCE (S256). Required by X & TikTok, optional but recommended otherwise. */
  pkce: boolean;
  /** Some providers (X) require Basic auth on the token endpoint. */
  tokenAuth?: "basic" | "body";
  /** Extra params to add to the authorize URL. */
  extraAuthParams?: Record<string, string>;
  /** ENV names for credentials. */
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Optional userinfo endpoint to fetch the connected account profile. */
  userInfo?: (accessToken: string) => Promise<{
    id: string;
    handle?: string;
    name?: string;
    avatar?: string;
  }>;
}

async function jsonGet(url: string, token: string, header: "bearer" | "oauth" = "bearer") {
  const res = await fetch(url, {
    headers: {
      Authorization: header === "bearer" ? `Bearer ${token}` : `OAuth ${token}`,
    },
  });
  if (!res.ok) throw new Error(`userinfo ${res.status}: ${await res.text()}`);
  return res.json() as Promise<any>;
}

export const PROVIDERS: Record<PlatformId, ProviderConfig> = {
  facebook: {
    id: "facebook",
    name: "Facebook",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: "public_profile,email,pages_show_list,pages_read_engagement,pages_read_user_content,read_insights,ads_read,instagram_basic,instagram_manage_insights,business_management",
    pkce: false,
    clientIdEnv: "META_CLIENT_ID",
    clientSecretEnv: "META_CLIENT_SECRET",
    userInfo: async (t) => {
      const j = await jsonGet(`https://graph.facebook.com/v21.0/me?fields=id,name,picture`, t);
      return { id: j.id, name: j.name, avatar: j.picture?.data?.url };
    },
  },
  instagram: {
    // Instagram via Facebook Login for Business (Graph API)
    id: "instagram",
    name: "Instagram",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: "public_profile,email,pages_show_list,pages_read_engagement,pages_read_user_content,read_insights,ads_read,instagram_basic,instagram_manage_insights,business_management",
    pkce: false,
    clientIdEnv: "META_CLIENT_ID",
    clientSecretEnv: "META_CLIENT_SECRET",
    userInfo: async (t) => {
      const j = await jsonGet(`https://graph.facebook.com/v21.0/me?fields=id,name`, t);
      return { id: j.id, name: j.name };
    },
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: "openid profile email r_organization_social rw_organization_admin r_organization_admin r_ads_reporting",
    pkce: false,
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
    userInfo: async (t) => {
      const j = await jsonGet("https://api.linkedin.com/v2/userinfo", t);
      return { id: j.sub, name: j.name, avatar: j.picture, handle: j.email };
    },
  },
  youtube: {
    id: "youtube",
    name: "YouTube",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes:
      "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
    pkce: true,
    extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    userInfo: async (t) => {
      const j = await jsonGet(
        "https://youtube.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        t,
      );
      const ch = j.items?.[0];
      return {
        id: ch?.id ?? "me",
        name: ch?.snippet?.title,
        handle: ch?.snippet?.customUrl,
        avatar: ch?.snippet?.thumbnails?.default?.url,
      };
    },
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: "user.info.basic,user.info.profile,user.info.stats,video.list",
    pkce: true,
    extraAuthParams: { },
    clientIdEnv: "TIKTOK_CLIENT_KEY",
    clientSecretEnv: "TIKTOK_CLIENT_SECRET",
    userInfo: async (t) => {
      const j = await jsonGet(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,username,display_name,avatar_url",
        t,
      );
      const u = j?.data?.user;
      return { id: u?.open_id ?? "me", handle: u?.username, name: u?.display_name, avatar: u?.avatar_url };
    },
  },
  x: {
    id: "x",
    name: "X / Twitter",
    authorizeUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    scopes: "tweet.read users.read offline.access",
    pkce: true,
    tokenAuth: "basic",
    clientIdEnv: "X_CLIENT_ID",
    clientSecretEnv: "X_CLIENT_SECRET",
    userInfo: async (t) => {
      const j = await jsonGet("https://api.twitter.com/2/users/me?user.fields=profile_image_url,username,name", t);
      return { id: j.data?.id, handle: j.data?.username, name: j.data?.name, avatar: j.data?.profile_image_url };
    },
  },
};

export function getProvider(id: string): ProviderConfig {
  const p = PROVIDERS[id as PlatformId];
  if (!p) throw new Error(`Unknown platform: ${id}`);
  return p;
}

export function getProviderCreds(p: ProviderConfig) {
  const clientId = process.env[p.clientIdEnv];
  const clientSecret = process.env[p.clientSecretEnv];
  if (!clientId || !clientSecret) {
    throw new Error(
      `OAuth credentials missing for ${p.name}. Set ${p.clientIdEnv} and ${p.clientSecretEnv}.`,
    );
  }
  return { clientId, clientSecret };
}

export function callbackUrl(origin: string, platform: PlatformId) {
  const appOrigin = process.env.APP_URL || process.env.SITE_URL || origin;
  return `${appOrigin.replace(/\/$/, "")}/api/oauth/${platform}/callback`;
}
