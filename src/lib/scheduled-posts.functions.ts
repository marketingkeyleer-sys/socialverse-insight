import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const publishablePlatform = z.enum(["instagram", "facebook", "linkedin", "youtube"]);

const createInput = z.object({
  content: z.string(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(["image", "video"]).optional(),
  mediaPath: z.string().optional(),
  scheduledAt: z.string().datetime().optional(), // absent = publish now
  targets: z
    .array(
      z.object({
        connectedAccountId: z.string().uuid(),
        platform: publishablePlatform,
        platformOptions: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .min(1),
});

export const createScheduledPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: post, error: postErr } = await supabase
      .from("scheduled_posts")
      .insert({
        user_id: userId,
        content: data.content,
        media_url: data.mediaUrl ?? null,
        media_type: data.mediaType ?? null,
        media_path: data.mediaPath ?? null,
        status: "scheduled",
        scheduled_at: data.scheduledAt ?? null,
      })
      .select()
      .single();
    if (postErr) throw new Error(postErr.message);

    const scheduledAtIso = data.scheduledAt ?? new Date().toISOString();
    const rows = data.targets.map((t) => ({
      post_id: post.id,
      user_id: userId,
      connected_account_id: t.connectedAccountId,
      platform: t.platform,
      scheduled_at: scheduledAtIso,
      platform_options: (t.platformOptions ?? {}) as Json,
    }));

    const { error: targetsErr } = await supabase.from("post_targets").insert(rows);
    if (targetsErr) {
      await supabase.from("scheduled_posts").delete().eq("id", post.id);
      throw new Error(targetsErr.message);
    }

    return { id: post.id };
  });

export const listScheduledPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("scheduled_posts")
      .select("*, post_targets(*)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { posts: data ?? [] };
  });

export const cancelScheduledPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: post, error } = await supabase
      .from("scheduled_posts")
      .update({ status: "canceled" })
      .eq("id", data.id)
      .eq("status", "scheduled")
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!post) throw new Error("Post is no longer cancelable (already publishing or completed).");

    await supabase
      .from("post_targets")
      .update({ status: "canceled" })
      .eq("post_id", data.id)
      .eq("status", "pending");
    return { ok: true };
  });
