// Shared helpers for platform publish adapters (src/lib/publish/*.server.ts).
import { usableAccessToken, type ConnectedAccountRow } from "@/lib/oauth/token-refresh.server";

export type { ConnectedAccountRow };
export { usableAccessToken };

export type PublishResult =
  | { providerPostId: string; providerPostUrl?: string }
  | { error: string };

export type PostTargetRow = {
  id: string;
  post_id: string;
  user_id: string;
  connected_account_id: string;
  platform: string;
  status: string;
  scheduled_at: string;
  attempts: number;
  platform_options: Record<string, unknown>;
};

export type ScheduledPostRow = {
  id: string;
  user_id: string;
  content: string;
  media_url: string | null;
  media_type: "image" | "video" | null;
  media_path: string | null;
  scheduled_at: string | null;
};

export const GRAPH_VERSION = "v21.0";

export async function graphFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const message = json?.error?.message ?? json?.message ?? text;
    const code = json?.error?.code;
    const reconnectHint =
      code === 200 || code === 10 ? " — reconnect the account to grant posting permission." : "";
    throw new Error(`${message}${reconnectHint}`);
  }
  return json;
}

export type FacebookPage = {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  instagramBusinessAccountId?: string;
};

/** Resolves the user's Facebook Page (and optionally its linked Instagram Business account) + page access token. */
export async function getFacebookPage(
  account: ConnectedAccountRow,
  opts: { withInstagram?: boolean } = {},
): Promise<FacebookPage | null> {
  const token = await usableAccessToken(account);
  const fields = opts.withInstagram
    ? "id,name,access_token,instagram_business_account{id}"
    : "id,name,access_token";
  const json = await graphFetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=${fields}&limit=25`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const pages = (json?.data ?? []) as Array<{
    id?: string;
    name?: string;
    access_token?: string;
    instagram_business_account?: { id?: string };
  }>;
  const eligible = opts.withInstagram ? pages.filter((p) => p.instagram_business_account) : pages;
  if (!eligible.length) return null;

  // Respect a page the user explicitly picked (see facebook-pages.functions.ts);
  // otherwise fall back to the first eligible page rather than leaving it unset —
  // a documented default, not a silent guess, for users who never pick one.
  const selectedPageId =
    typeof account.meta.selected_page_id === "string" ? account.meta.selected_page_id : undefined;
  const page =
    (selectedPageId ? eligible.find((p) => p.id === selectedPageId) : undefined) ?? eligible[0];
  if (!page?.id || !page?.access_token) return null;
  return {
    pageId: page.id,
    pageName: page.name ?? "",
    pageAccessToken: page.access_token,
    instagramBusinessAccountId: page.instagram_business_account?.id,
  };
}

export function errorResult(error: unknown): { error: string } {
  return { error: error instanceof Error ? error.message : String(error) };
}
