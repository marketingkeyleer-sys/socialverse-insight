import { PUBLISHERS } from "@/lib/publish/index.server";
import type {
  ConnectedAccountRow,
  PostTargetRow,
  ScheduledPostRow,
} from "@/lib/publish/shared.server";

const STALE_LOCK_MINUTES = 10;
const CLAIM_BATCH_SIZE = 50;
const TERMINAL_TARGET_STATUSES = ["published", "failed", "canceled"];

type ClaimedTargetRow = PostTargetRow & {
  connected_accounts: ConnectedAccountRow | null;
  scheduled_posts: ScheduledPostRow | null;
};

/** Runs on the Cloudflare Cron Trigger (see scheduled() in src/server.ts). */
export async function runDuePosts(): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  const nowIso = now.toISOString();
  const staleThreshold = new Date(now.getTime() - STALE_LOCK_MINUTES * 60_000).toISOString();

  // Reclaim targets abandoned mid-flight by a killed Worker invocation.
  await supabaseAdmin
    .from("post_targets")
    .update({ status: "pending", locked_at: null })
    .eq("status", "publishing")
    .lt("locked_at", staleThreshold);

  // Atomic claim: a single UPDATE...WHERE means two overlapping cron ticks
  // can never both claim the same row, so no separate lock table is needed.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("post_targets")
    .update({ status: "publishing", locked_at: nowIso })
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .is("locked_at", null)
    .select("*, connected_accounts(*), scheduled_posts(*)")
    .limit(CLAIM_BATCH_SIZE);

  if (claimError) {
    console.error("[scheduler] claim failed:", claimError.message);
    return;
  }
  if (!claimed?.length) return;

  const postIds = new Set<string>();

  for (const row of claimed as unknown as ClaimedTargetRow[]) {
    const target = row;
    const account = row.connected_accounts;
    const post = row.scheduled_posts;
    postIds.add(target.post_id);

    if (!account || !post) {
      await supabaseAdmin
        .from("post_targets")
        .update({
          status: "failed",
          error_message: "Connected account or post was deleted.",
          locked_at: null,
        })
        .eq("id", target.id);
      continue;
    }

    const publisher = PUBLISHERS[target.platform as keyof typeof PUBLISHERS];
    const result = await publisher(account, target, post).catch((e) => ({
      error: e instanceof Error ? e.message : String(e),
    }));

    if ("error" in result) {
      await supabaseAdmin
        .from("post_targets")
        .update({
          status: "failed",
          error_message: result.error,
          attempts: target.attempts + 1,
          locked_at: null,
        })
        .eq("id", target.id);
    } else {
      await supabaseAdmin
        .from("post_targets")
        .update({
          status: "published",
          provider_post_id: result.providerPostId,
          provider_post_url: result.providerPostUrl ?? null,
          published_at: new Date().toISOString(),
          locked_at: null,
        })
        .eq("id", target.id);
    }
  }

  // Roll up each affected post's header status once all its targets are terminal.
  for (const postId of postIds) {
    const { data: targets } = await supabaseAdmin
      .from("post_targets")
      .select("status")
      .eq("post_id", postId);
    const statuses = (targets ?? []).map((t) => t.status as string);
    if (!statuses.length) continue;
    const allDone = statuses.every((s) => TERMINAL_TARGET_STATUSES.includes(s));
    if (!allDone) continue;

    const rollup = statuses.every((s) => s === "published")
      ? "published"
      : statuses.every((s) => s === "failed")
        ? "failed"
        : statuses.some((s) => s === "published")
          ? "partial"
          : "canceled";

    await supabaseAdmin
      .from("scheduled_posts")
      .update({ status: rollup, published_at: new Date().toISOString() })
      .eq("id", postId);
  }
}
