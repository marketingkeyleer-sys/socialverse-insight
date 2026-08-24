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

  // Reclaim targets abandoned mid-flight by a killed Worker invocation. We can't
  // safely know whether the provider actually accepted the post before the
  // Worker died, so this does NOT silently reset to 'pending' for automatic
  // retry — that would risk a duplicate publish. Instead it's marked 'failed'
  // with a message asking for manual verification before any retry.
  await supabaseAdmin
    .from("post_targets")
    .update({
      status: "failed",
      error_message:
        "Publish attempt was interrupted and could not be safely retried automatically — check the platform before retrying.",
      locked_at: null,
    })
    .eq("status", "publishing")
    .lt("locked_at", staleThreshold);

  // Atomic claim: a single UPDATE...WHERE means two overlapping cron ticks
  // can never both claim the same row, so no separate lock table is needed.
  // YouTube targets are claimed as soon as they're pending, regardless of
  // scheduled_at — the upload itself starts immediately, but when scheduled_at
  // is still in the future, publishYouTube uploads it privately with YouTube's
  // own publishAt so release timing stays precise instead of being coupled to
  // cron granularity + upload duration. Every other platform still waits for
  // its scheduled_at to elapse before being claimed at all.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("post_targets")
    .update({ status: "publishing", locked_at: nowIso })
    .eq("status", "pending")
    .or(`scheduled_at.lte.${nowIso},platform.eq.youtube`)
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

    // Never overwrite a post the user canceled in the meantime — a target
    // claimed just before cancellation can still complete after the user
    // canceled its parent, and the rollup shouldn't silently undo that.
    await supabaseAdmin
      .from("scheduled_posts")
      .update({ status: rollup, published_at: new Date().toISOString() })
      .eq("id", postId)
      .neq("status", "canceled");
  }
}
