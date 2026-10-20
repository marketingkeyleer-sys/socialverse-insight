// Called every 5 minutes by a Postgres pg_cron job (see migration
// 009_auto_sync_cron.sql) — same CRON_SECRET pattern as run-due-posts.
// Finds every connected account whose sync_interval_minutes has elapsed
// since last_synced_at (or that's never been synced at all) and syncs it,
// so "Sync now" stops being the only way data ever updates.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { syncAccount } from "../_shared/sync.ts";

const BATCH_SIZE = 25;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || token !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // Service-role: this processes every user's due accounts in one run,
    // not just one caller's own rows.
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Only platforms with real sync logic are worth fetching — asking for
    // LinkedIn rows here would just waste a query on accounts syncAccount()
    // is going to immediately no-op for anyway.
    const { data: accounts, error: acctErr } = await admin
      .from("sv_connected_accounts")
      .select("*")
      .eq("is_active", true)
      .in("platform", ["facebook", "instagram", "youtube"]);
    if (acctErr) throw new Error(acctErr.message);

    const now = Date.now();
    const due = (accounts ?? [])
      .filter((a) => {
        if (!a.last_synced_at) return true;
        const dueAt = new Date(a.last_synced_at).getTime() + a.sync_interval_minutes * 60 * 1000;
        return dueAt <= now;
      })
      .slice(0, BATCH_SIZE);

    if (due.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const outcomes = await Promise.allSettled(
      due.map((account) => syncAccount(admin, account.user_id, account, account.id)),
    );

    const summary = outcomes.map((o, i) => ({
      accountId: due[i].id,
      platform: due[i].platform,
      ok: o.status === "fulfilled",
      postsSynced: o.status === "fulfilled" ? o.value.postsSynced : 0,
      error: o.status === "rejected" ? String(o.reason) : undefined,
      warnings: o.status === "fulfilled" ? o.value.warnings : undefined,
    }));

    // A full failure always gets logged (the one outcome a user needs to
    // notice without checking /accounts themselves). A success that still
    // carries warnings (e.g. a platform permission gate blocking one field)
    // gets logged too, but only once per day per account — otherwise a
    // standing platform-side gap would re-log identically every single sync
    // interval forever and drown the activity feed.
    const failedRows = summary
      .filter((s) => !s.ok)
      .map((s) => ({
        user_id: due.find((d) => d.id === s.accountId)!.user_id,
        action: "sync_failed",
        entity_type: "connected_account",
        entity_id: s.accountId,
        metadata: { platform: s.platform, error: s.error },
      }));

    const warned = summary.filter((s) => s.ok && s.warnings && s.warnings.length > 0);
    let warningRows: { user_id: string; action: string; entity_type: string; entity_id: string; metadata: { platform: string; warnings?: string[] } }[] = [];
    if (warned.length > 0) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentWarnings } = await admin
        .from("sv_activity_log")
        .select("entity_id")
        .eq("action", "sync_warning")
        .gte("created_at", since)
        .in("entity_id", warned.map((s) => s.accountId));
      const alreadyWarnedToday = new Set((recentWarnings ?? []).map((r) => r.entity_id));
      warningRows = warned
        .filter((s) => !alreadyWarnedToday.has(s.accountId))
        .map((s) => ({
          user_id: due.find((d) => d.id === s.accountId)!.user_id,
          action: "sync_warning",
          entity_type: "connected_account",
          entity_id: s.accountId,
          metadata: { platform: s.platform, warnings: s.warnings },
        }));
    }

    const logRows = [...failedRows, ...warningRows];
    if (logRows.length > 0) {
      await admin.from("sv_activity_log").insert(logRows);
    }

    return new Response(JSON.stringify({ ok: true, synced: due.length, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
