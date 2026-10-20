// Called every 5 minutes by a Postgres pg_cron job (see migration
// 007_scheduled_publish_cron.sql) — NOT by a user, so there's no Supabase
// session JWT here. Authenticated instead by a shared secret only the cron
// job and this function know (CRON_SECRET), checked manually since
// verify_jwt is off for this function (a cron-issued bearer token isn't a
// real Supabase JWT, so platform-level verify_jwt would reject it outright).
//
// This is what actually makes "Schedule for later" work — without it,
// scheduled posts just sit at status='scheduled' forever with nothing to
// fire them at the chosen time.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { publishPost } from "../_shared/publish.ts";

const BATCH_SIZE = 20;

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
    // Service-role: this processes every user's due posts in one run, not
    // just one caller's own rows, so it can't go through the RLS-scoped
    // pattern every other function here uses.
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: due, error: dueErr } = await admin
      .from("sv_posts")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (dueErr) throw new Error(dueErr.message);
    if (!due || due.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Claimed as "publishing" up front so a slow run overlapping the next
    // 5-minute tick can't double-publish the same post.
    // publishPost performs the atomic claim. Reading the due list alone
    // does not give this worker ownership of any post.

    const outcomes = await Promise.allSettled(
      due.map((post) => publishPost(admin, post.user_id, post)),
    );

    const summary = outcomes.map((o, i) => ({
      postId: due[i].id,
      ok: o.status === "fulfilled",
      overallStatus: o.status === "fulfilled" ? o.value.overallStatus : "failed",
    }));

    // A post whose publish attempt threw before publishPost could record any
    // outcome (network error before the per-platform loop, etc.) needs its
    // status set explicitly — publishPost itself already updates sv_posts
    // for every post that got that far.
    const threwBeforeRecording = outcomes
      .map((o, i) => ({ o, id: due[i].id }))
      .filter(({ o }) => o.status === "rejected");
    if (threwBeforeRecording.length > 0) {
      await admin
        .from("sv_posts")
        .update({ status: "failed" })
        .eq("status", "scheduled")
        .in("id", threwBeforeRecording.map((t) => t.id));
    }

    return new Response(JSON.stringify({ ok: true, processed: due.length, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
