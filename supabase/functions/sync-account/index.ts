// Authenticated: pulls one connected account's full real post history and as
// much analytics history as its platform still retains, right now (the
// "Sync now" button — see run-due-syncs for the auto-sync version, which
// shares this same logic via _shared/sync.ts). Runs on the caller's own
// RLS-scoped client — every table it touches already has an owner-only
// policy, so no service-role client is needed here.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { syncAccount } from "../_shared/sync.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { accountId } = await req.json();
    const { data: account, error: accountErr } = await supabase
      .from("sv_connected_accounts")
      .select("*")
      .eq("id", accountId)
      .single();
    if (accountErr || !account) throw new Error("Connected account not found");

    const result = await syncAccount(supabase, userData.user.id, account, accountId);

    return new Response(
      JSON.stringify({
        ok: true,
        postsSynced: result.postsSynced,
        daysSynced: result.daysSynced,
        warnings: result.warnings.length > 0 ? result.warnings : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
