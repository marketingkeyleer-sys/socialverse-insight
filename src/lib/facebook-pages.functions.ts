// Lets a user with more than one Facebook Page pick which one this app posts
// to, instead of always silently defaulting to whichever Page the Graph API
// happens to list first (see getFacebookPage in publish/shared.server.ts).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { usableAccessToken, type ConnectedAccountRow } from "@/lib/oauth/token-refresh.server";
import { GRAPH_VERSION, graphFetch } from "@/lib/publish/shared.server";

export const listFacebookPages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: account, error } = await context.supabase
      .from("connected_accounts")
      .select("*")
      .eq("platform", "facebook")
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!account) return { pages: [], selectedPageId: null };

    const row = account as unknown as ConnectedAccountRow;
    const token = await usableAccessToken(row);
    const json = await graphFetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=id,name&limit=25`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const pages = ((json?.data ?? []) as Array<{ id?: string; name?: string }>)
      .filter((p): p is { id: string; name: string } => Boolean(p.id))
      .map((p) => ({ id: p.id, name: p.name ?? p.id }));

    const selectedPageId = typeof row.meta.selected_page_id === "string" ? row.meta.selected_page_id : null;

    return { pages, selectedPageId };
  });

export const selectFacebookPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ pageId: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: account, error: fetchErr } = await context.supabase
      .from("connected_accounts")
      .select("id, meta")
      .eq("platform", "facebook")
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!account) throw new Error("Facebook is not connected.");

    const existingMeta = (account.meta ?? {}) as Record<string, unknown>;
    const { error: updateErr } = await context.supabase
      .from("connected_accounts")
      .update({ meta: { ...existingMeta, selected_page_id: data.pageId } })
      .eq("id", account.id);
    if (updateErr) throw new Error(updateErr.message);

    return { ok: true };
  });
