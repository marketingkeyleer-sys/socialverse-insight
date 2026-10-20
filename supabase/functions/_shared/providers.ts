// Provider registry. Connection uses minimal scopes by default; installations
// enable approved publishing/messaging scopes through server configuration.
// Organization access has separate credentials to support existing deployments.
export type PlatformId = "facebook" | "instagram" | "youtube" | "linkedin" | "linkedin_page";

export interface ProviderConfig {
  id: PlatformId;
  name: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;
  pkce: boolean;
  tokenAuth?: "basic" | "body";
  extraAuthParams?: Record<string, string>;
  clientIdEnv: string;
  clientSecretEnv: string;
  // Returns an array, not a single identity — a Facebook/Instagram login
  // can legitimately unlock several Pages (or several IG Business accounts,
  // one per Page) in one authorization, and every one of them should get
  // connected, not silently just the first. Other providers return a
  // single-element array. oauth-callback loops over every entry and
  // upserts a separate sv_connected_accounts row for each.
  userInfo: (accessToken: string) => Promise<
    {
      id: string;
      handle?: string;
      name?: string;
      avatar?: string;
      followers?: number;
      following?: number;
      posts?: number;
      // Facebook Pages have their own access token, separate from the user
      // token — Page Insights and page-post reads require it, so oauth-callback
      // stores it (encrypted) alongside the account when a provider returns one.
      pageAccessToken?: string;
    }[]
  >;
}

async function jsonGet(url: string, token: string, extraHeaders?: Record<string, string>) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, ...extraHeaders }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status === 429 || body?.error?.code === 4 || body?.error?.code === 17) {
      throw new Error("The platform is temporarily limiting requests. Wait a few minutes, then try connecting again.");
    }
    if (res.status === 401 || body?.error?.code === 190) {
      throw new Error("Your platform authorization expired or was revoked. Sign in again and review the access you allow.");
    }
    if (res.status === 403 || [10, 200].includes(body?.error?.code)) {
      throw new Error("The platform has not allowed this account access. Check your Page or channel role and selected assets. The application owner may also need provider approval.");
    }
    throw new Error(`Account discovery failed (HTTP ${res.status}). Check app permissions and reconnect.`);
  }
  // deno-lint-ignore no-explicit-any
  return res.json() as Promise<any>;
}

async function metaPages(url: string, token: string) {
  // Follow provider pagination, retaining a fixed trusted origin. Do not
  // truncate a user's authorized Pages after the first hundred.
  const data = [];
  const visited = new Set<string>();
  let next: string | undefined = url;
  while (next) {
    const parsed = new URL(next);
    if (parsed.origin !== "https://graph.facebook.com" || parsed.username || parsed.password) throw new Error("Invalid account pagination URL");
    if (visited.has(parsed.toString()) || visited.size >= 100) throw new Error("Account discovery could not finish. Please try connecting again.");
    visited.add(parsed.toString());
    const page = await jsonGet(parsed.toString(), token);
    data.push(...(page.data ?? []));
    next = page.paging?.next;
    if (data.length > 10000) throw new Error("Too many Pages to discover in one request");
  }
  return { data };
}

// Only the scopes each provider's userInfo() below actually reads —
// requesting anything wider gets rejected as "Invalid Scopes" unless it's
// separately been added to the Meta App under Permissions and Features.
// pages_messaging/instagram_manage_messages power the Inbox feature — same
// "Add it under Permissions and Features" step every other scope here
// needed, and possibly the same kind of extra platform-side gate the
// engagement/insights metrics turned out to need (see _shared/sync.ts).
// Already-connected accounts keep their old scopes until reconnected.
// ads_management is the most sensitive scope requested anywhere in this
// app — real Marketing API access, real ad spend. It needs Meta App Review
// (Business Verification + submission) same as Page Public Content Access,
// and won't work until that's approved regardless of what's built here.
const FACEBOOK_SCOPES = "public_profile,pages_show_list,pages_read_engagement";
const INSTAGRAM_SCOPES = "public_profile,pages_show_list,pages_read_engagement,instagram_basic";

export const PROVIDERS: Record<PlatformId, ProviderConfig> = {
  facebook: {
    id: "facebook",
    name: "Facebook",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: FACEBOOK_SCOPES,
    pkce: false,
    // Optional Login for Business configuration comes from META_LOGIN_CONFIG_ID.
    extraAuthParams: {},
    clientIdEnv: "META_CLIENT_ID",
    clientSecretEnv: "META_CLIENT_SECRET",
    userInfo: async (token) => {
      const pages = await metaPages(
        "https://graph.facebook.com/v21.0/me/accounts?fields=id,name,fan_count,access_token,picture&limit=100",
        token,
      );
      const list = (pages?.data ?? []) as {
        id: string;
        name?: string;
        fan_count?: number;
        access_token?: string;
        picture?: { data?: { url?: string } };
      }[];
      if (list.length === 0) {
        // Facebook's Graph API only lets third-party apps manage Pages, not
        // personal profiles — this isn't a bug here, it's how Facebook Login
        // has worked since the 2018 platform changes. A personal account
        // with no Page has nothing this app can connect to.
        throw new Error(
          "No Facebook Pages found on this account. Facebook only allows apps like this one to connect to Pages, not personal profiles — create a Page (or get added as an admin on one), then reconnect.",
        );
      }
      return list.map((page) => ({
        id: page.id,
        name: page.name,
        avatar: page.picture?.data?.url,
        followers: page.fan_count ?? 0,
        pageAccessToken: page.access_token,
      }));
    },
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: INSTAGRAM_SCOPES,
    pkce: false,
    // Use the configuration associated with this installation, never a personal app ID.
    extraAuthParams: {},
    clientIdEnv: "META_CLIENT_ID",
    clientSecretEnv: "META_CLIENT_SECRET",
    userInfo: async (token) => {
      const pages = await metaPages(
        "https://graph.facebook.com/v21.0/me/accounts?fields=access_token,instagram_business_account{id,username,profile_picture_url,followers_count,follows_count,media_count}&limit=100",
        token,
      );
      // deno-lint-ignore no-explicit-any
      const withIg = ((pages?.data ?? []) as any[]).filter((p) => p.instagram_business_account);
      if (withIg.length === 0) {
        throw new Error(
          "No Instagram Business/Creator account found. Instagram access goes through a linked Facebook Page — make sure your Instagram account is a Business or Creator account linked to a Page you manage, then reconnect.",
        );
      }
      return withIg.map((p) => {
        const ig = p.instagram_business_account;
        return {
          id: ig.id,
          handle: ig.username,
          name: ig.username,
          avatar: ig.profile_picture_url,
          followers: ig.followers_count ?? 0,
          following: ig.follows_count ?? 0,
          posts: ig.media_count ?? 0,
          // Instagram Graph API media/insights reads need the Page's own
          // token, same as Facebook — not captured before this fix, which is
          // why sync couldn't do anything for accounts connected earlier.
          pageAccessToken: p.access_token,
        };
      });
    },
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: "openid profile email",
    pkce: false,
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
    userInfo: async (token) => {
      const j = await jsonGet("https://api.linkedin.com/v2/userinfo", token);
      return [{ id: j.sub, name: j.name, avatar: j.picture, handle: j.email }];
    },
  },
  linkedin_page: {
    id: "linkedin_page",
    name: "LinkedIn Page",
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: "r_organization_social,rw_organization_admin,w_organization_social",
    pkce: false,
    clientIdEnv: "LINKEDIN_ORG_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_ORG_CLIENT_SECRET",
    // Untested against a real approved Community Management API grant — the
    // LinkedIn-Version header value and exact field names here are based on
    // LinkedIn's documented REST API conventions, not a live-verified call
    // (this session has no way to test until the product is approved).
    userInfo: async (token) => {
      const j = await jsonGet(
        "https://api.linkedin.com/rest/organizationAcls" +
          "?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED" +
          "&projection=(elements*(organization~(id,localizedName,vanityName)))",
        token,
        { "LinkedIn-Version": Deno.env.get("LINKEDIN_API_VERSION") ?? "202609", "X-Restli-Protocol-Version": "2.0.0" },
      );
      // deno-lint-ignore no-explicit-any
      const organizations = (j.elements ?? []).map((entry: Record<string, unknown>) => entry["organization~"]).filter(Boolean);
      if (!organizations.length) throw new Error("No LinkedIn Company Page found where you're an administrator.");
      return organizations.map((org: { id: string; localizedName?: string; vanityName?: string }) => ({
        id: String(org.id), name: org.localizedName, handle: org.vanityName,
      }));
    },
  },
  youtube: {
    id: "youtube",
    name: "YouTube",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.upload",
    pkce: true,
    // Keep channel authorization separate from earlier Google sign-in grants.
    // A new connection must let the owner choose a different Google identity.
    extraAuthParams: { access_type: "offline", prompt: "select_account consent", include_granted_scopes: "false" },
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    userInfo: async (token) => {
      const channels = new Map();
      const visited = new Set<string>();
      let pageToken = "";
      do {
        if (visited.has(pageToken) || visited.size >= 100) throw new Error("Channel discovery could not finish. Please try connecting again.");
        visited.add(pageToken);
        const url = new URL("https://youtube.googleapis.com/youtube/v3/channels");
        url.search = new URLSearchParams({ part: "snippet,statistics", mine: "true", maxResults: "50", ...(pageToken ? {pageToken} : {}) }).toString();
        const page = await jsonGet(url.toString(), token);
        for (const channel of page.items ?? []) if (channel.id) channels.set(channel.id, channel);
        pageToken = page.nextPageToken ?? "";
      } while (pageToken);
      if (!channels.size) throw new Error("No YouTube channel found. Choose the Google or Brand Account that owns your channel, then reconnect.");
      return [...channels.values()].map(ch => ({
        id: ch.id,
        name: ch.snippet?.title,
        handle: ch.snippet?.customUrl,
        avatar: ch.snippet?.thumbnails?.default?.url,
        followers: Number(ch.statistics?.subscriberCount ?? 0),
        posts: Number(ch.statistics?.videoCount ?? 0),
      }));
    },
  },
};

export function getProvider(id: string): ProviderConfig {
  const p = Object.hasOwn(PROVIDERS, id) ? PROVIDERS[id as PlatformId] : undefined;
  if (!p) throw new Error(`Unknown platform: ${id}`);
  const prefix = id === "facebook" || id === "instagram" ? "META" : id.toUpperCase();
  const scopes = Deno.env.get(`${id.toUpperCase()}_OAUTH_SCOPES`) ?? p.scopes;
  const configId = prefix === "META" ? Deno.env.get("META_LOGIN_CONFIG_ID") : undefined;
  return { ...p, scopes, extraAuthParams: { ...p.extraAuthParams, ...(configId ? { config_id: configId } : {}) } };
}

export function getProviderCreds(p: ProviderConfig) {
  const clientId = Deno.env.get(p.clientIdEnv);
  const clientSecret = Deno.env.get(p.clientSecretEnv);
  if (!clientId || !clientSecret) {
    throw new Error(`OAuth credentials missing for ${p.name}. Set ${p.clientIdEnv} and ${p.clientSecretEnv} as Edge Function secrets.`);
  }
  return { clientId, clientSecret };
}

export function callbackUrl(supabaseUrl: string, platform: PlatformId): string {
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/oauth-callback/${platform}`;
}
