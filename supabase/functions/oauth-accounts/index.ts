import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { validateSelection } from "../_shared/oauth-policy.ts";
import { uploadPostBinding, verifiedUploadPostPage, UPLOADPOST_SCOPE } from "../_shared/uploadpost.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (req.method !== "POST") return json({ error: "Use POST" }, 405);
    const url = Deno.env.get("SUPABASE_URL")!;
    const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return json({ error: "Not authenticated" }, 401);
    const { requestId, selectedIds, cancel } = await req.json();
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: pending, error: lookupError } = await admin.from("sv_oauth_pending").select("*")
      .eq("id", requestId).eq("user_id", data.user.id).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (lookupError || !pending) return json({ error: "Connection request not found or expired. Please reconnect." }, 404);
    if (cancel) {
      await admin.from("sv_oauth_pending").delete().eq("id", pending.id).eq("user_id", data.user.id);
      return json({ ok: true });
    }
    if (selectedIds !== undefined) {
      validateSelection(pending.accounts, selectedIds);
      if (pending.accounts.some((a: { scopes?: string[] }) => a.scopes?.includes(UPLOADPOST_SCOPE))) {
        const binding = uploadPostBinding(data.user.id, pending.brand_id);
        if (!binding || selectedIds.some((id: string) => id !== binding.pageId)) throw new Error("LinkedIn Page binding changed. Please reconnect.");
        await verifiedUploadPostPage(binding);
      }
      const { data: count, error: saveError } = await admin.rpc("sv_confirm_oauth", {
        request_id: pending.id, owner_id: data.user.id, selected_ids: selectedIds,
      });
      if (saveError) throw new Error(saveError.code === "23505" ? "This brand already has an account on this platform. Choose another brand." : saveError.message);
      return json({ ok: true, connectedCount: count });
    }
    // Explicit allowlist: ciphertext, IVs, and refresh credentials never leave the server.
    return json({ platform: pending.platform, brandId: pending.brand_id, accounts: pending.accounts.map((a: Record<string, unknown>) => ({
      id: a.platform_user_id, name: a.platform_display_name ?? a.platform_username ?? a.platform_user_id,
    })) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Connection failed" }, 400);
  }
});
