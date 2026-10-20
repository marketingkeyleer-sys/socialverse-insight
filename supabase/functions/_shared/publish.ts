// Shared by publish-post (user-triggered "Publish now", RLS-scoped client)
// and run-due-posts (the cron job that fires scheduled posts, service-role
// client) — same publish logic either way, just a different caller and a
// different Supabase client passed in.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { decryptToken } from "./crypto.ts";
import { getYouTubeAccessToken } from "./sync.ts";
import { createAndRunBroadcast } from "./whatsapp.ts";
import { selectPublishTargets } from "./publish-policy.ts";
import { publishLinkedInText } from "./linkedin.ts";
import { platformPostContent, validatePlatformDraft } from "./content-policy.ts";

const GRAPH_VERSION = "v21.0";

function publishError(error: unknown): string {
  // A transport failure can happen after the provider accepted the post.
  // Do not offer an automatic resend of such an indeterminate outcome.
  if (error instanceof TypeError) return "Outcome unknown. Check the platform before retrying: network request failed.";
  return error instanceof Error ? error.message : String(error);
}

export interface TargetResult {
  connectedAccountId?: string;
  platform: string;
  status: "published" | "failed";
  platformPostId: string | null;
  publishedUrl: string | null;
  errorMessage: string | null;
}

export interface PublishOutcome {
  results: TargetResult[];
  overallStatus: "published" | "partially_failed" | "failed";
}

async function publishToFacebook(
  pageId: string,
  pageToken: string,
  message: string,
  mediaUrls: string[],
): Promise<{ id: string; url: string }> {
  if (mediaUrls.length === 1 && isVideoUrl(mediaUrls[0])) {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/videos`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ file_url: mediaUrls[0], description: message, access_token: pageToken }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? "Facebook video publish failed");
    return { id: body.id, url: `https://www.facebook.com/watch/?v=${body.id}` };
  }
  if (mediaUrls.some(isVideoUrl)) throw new Error("Facebook supports one video or multiple images per post; separate mixed media into different posts");
  if (mediaUrls.length === 0) {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ message, access_token: pageToken }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? "Facebook post failed");
    return { id: json.id, url: `https://www.facebook.com/${json.id}` };
  }

  if (mediaUrls.length === 1) {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ url: mediaUrls[0], caption: message, access_token: pageToken }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? "Facebook photo post failed");
    const postId = json.post_id ?? json.id;
    return { id: postId, url: `https://www.facebook.com/${postId}` };
  }

  // Multiple images: upload each unpublished first, then attach them all to
  // one feed post — this is the only way Facebook supports a multi-photo post.
  const photoIds: string[] = [];
  for (const url of mediaUrls) {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ url, published: "false", access_token: pageToken }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? "Facebook photo upload failed");
    photoIds.push(json.id);
  }
  const body = new URLSearchParams({ message, access_token: pageToken });
  photoIds.forEach((id, i) => body.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? "Facebook multi-photo post failed");
  return { id: json.id, url: `https://www.facebook.com/${json.id}` };
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov)$/i.test(url);
}

async function pollInstagramContainer(containerId: string, token: string, maxWaitMs = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`,
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? "Could not check Instagram media status");
    if (json.status_code === "FINISHED") return;
    if (json.status_code === "ERROR") throw new Error("Instagram failed to process the media");
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Instagram media took too long to process — try again in a moment");
}

async function publishToInstagram(
  igId: string,
  token: string,
  caption: string,
  mediaUrls: string[],
): Promise<{ id: string; url: string }> {
  if (mediaUrls.length === 0) {
    throw new Error("Instagram requires at least one image or video — text-only posts aren't supported");
  }

  let creationId: string;

  if (mediaUrls.length === 1) {
    const url = mediaUrls[0];
    const params = new URLSearchParams({ caption, access_token: token });
    if (isVideoUrl(url)) {
      // Instagram's API only accepts video through the Reels container type
      // now — a plain feed "video" media_type was retired.
      params.set("media_type", "REELS");
      params.set("video_url", url);
    } else {
      params.set("image_url", url);
    }
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? "Instagram media upload failed");
    creationId = json.id;
    await pollInstagramContainer(creationId, token);
  } else {
    // Carousel: each item is its own container first, then a parent
    // container references them all by id.
    const childIds: string[] = [];
    for (const url of mediaUrls) {
      const params = new URLSearchParams({ is_carousel_item: "true", access_token: token });
      if (isVideoUrl(url)) { params.set("video_url", url); params.set("media_type", "VIDEO"); }
      else params.set("image_url", url);
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Instagram carousel item upload failed");
      childIds.push(json.id);
      await pollInstagramContainer(json.id, token);
    }
    const carouselRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        media_type: "CAROUSEL",
        caption,
        children: childIds.join(","),
        access_token: token,
      }),
    });
    const carouselJson = await carouselRes.json();
    if (!carouselRes.ok) throw new Error(carouselJson.error?.message ?? "Instagram carousel creation failed");
    creationId = carouselJson.id;
    await pollInstagramContainer(creationId, token);
  }

  const publishRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: creationId, access_token: token }),
  });
  const publishJson = await publishRes.json();
  if (!publishRes.ok) throw new Error(publishJson.error?.message ?? "Instagram publish failed");

  const permalinkRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${publishJson.id}?fields=permalink&access_token=${encodeURIComponent(token)}`,
  );
  const permalinkJson = await permalinkRes.json().catch(() => ({}));
  return { id: publishJson.id, url: permalinkJson.permalink ?? "https://www.instagram.com/" };
}

// deno-lint-ignore no-explicit-any
async function publishToYouTube(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any>,
  // deno-lint-ignore no-explicit-any
  account: any,
  accountId: string,
  title: string,
  description: string,
  mediaUrls: string[],
): Promise<{ id: string; url: string }> {
  const videoUrl = mediaUrls.find(isVideoUrl);
  if (!videoUrl) {
    throw new Error("YouTube requires a video file attached (MP4/MOV) — image-only posts can't be published here");
  }

  const token = await getYouTubeAccessToken(supabase, account, accountId);

  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/*",
      },
      body: JSON.stringify({
        snippet: { title: title.slice(0, 100), description },
        status: { privacyStatus: "public" },
      }),
    },
  );
  if (!initRes.ok) {
    const errJson = await initRes.json().catch(() => ({}));
    throw new Error(errJson.error?.message ?? `YouTube upload session failed (${initRes.status})`);
  }
  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("YouTube did not return an upload session URL");

  // Re-streams the file straight from Storage into YouTube's upload session
  // rather than buffering it in memory — the file is already fully hosted
  // (with a real Content-Length) so this is a single PUT, not the
  // multi-chunk resumable dance a browser-originated upload would need.
  const media = new URL(videoUrl);
  const storage = new URL(Deno.env.get("SUPABASE_URL")!);
  if (media.origin !== storage.origin || !media.pathname.startsWith(`/storage/v1/object/public/sv-media/${account.user_id}/`)) {
    throw new Error("Upload the video to your own media library before publishing");
  }
  const videoRes = await fetch(videoUrl, { redirect: "error" });
  if (!videoRes.ok || !videoRes.body) throw new Error("Could not fetch the uploaded video file");
  const putHeaders: Record<string, string> = { "Content-Type": videoRes.headers.get("content-type") ?? "video/mp4" };
  const contentLength = videoRes.headers.get("content-length");
  if (contentLength) putHeaders["Content-Length"] = contentLength;

  const putRes = await fetch(uploadUrl, { method: "PUT", headers: putHeaders, body: videoRes.body });
  const putJson = await putRes.json();
  if (!putRes.ok) throw new Error(putJson.error?.message ?? `YouTube video upload failed (${putRes.status})`);

  return { id: putJson.id, url: `https://www.youtube.com/watch?v=${putJson.id}` };
}

export async function publishPost(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  // deno-lint-ignore no-explicit-any
  post: any,
): Promise<PublishOutcome> {
  if (post.user_id !== userId) throw new Error("Post belongs to another user");
  const { data: accounts, error: accountsError } = await supabase
    .from("sv_connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .in("platform", post.platforms)
    .eq("is_active", true);

  if (accountsError) throw accountsError;
  const targets = selectPublishTargets(userId, post, accounts ?? []);
  if (!targets.length) throw new Error("Select at least one destination account");
  const targetContent = new Map(targets.map((account) => {
    const draft = platformPostContent(post, account.platform);
    validatePlatformDraft(account.platform, draft);
    return [account.id, draft] as const;
  }));
  const { data: history, error: historyError } = await supabase.from("sv_post_platform_results")
    .select("*").eq("post_id", post.id).eq("user_id", userId);
  if (historyError) throw historyError;
  if (history?.some((r: { error_message?: string }) => r.error_message?.startsWith("Outcome unknown"))) {
    throw new Error("A previous attempt has an unknown outcome. Verify the platform and reconcile the result before retrying.");
  }
  const previous = history?.filter((r: { status: string }) => r.status === "published");
  // Compare-and-set claim shared by manual and cron workers.
  const { data: claim, error: claimError } = await supabase.from("sv_posts")
    .update({ status: "publishing" }).eq("id", post.id).eq("user_id", userId)
    .in("status", ["draft", "scheduled", "failed", "partially_failed"]).select("id").maybeSingle();
  if (claimError) throw claimError;
  if (!claim) throw new Error("Post is already publishing or published");
  const allResults: TargetResult[] = [];

  for (const account of targets) {
    const targetPost = targetContent.get(account.id)!;
    const platform = account.platform;
    const results = { push: (result: TargetResult) => allResults.push({ ...result, connectedAccountId: account.id }) };
    const alreadyPublished = previous?.find((r: { connected_account_id: string }) => r.connected_account_id === account.id);
    await (async () => {
      if (alreadyPublished) {
        results.push({ platform, status: "published", platformPostId: alreadyPublished.platform_post_id, publishedUrl: alreadyPublished.published_url, errorMessage: null });
        return;
      }
      if (platform === "linkedin" || platform === "linkedin_page") {
        try {
          if (targetPost.media_urls?.length) throw new Error("LinkedIn currently supports text posts here. Remove media or publish this destination separately.");
          if (!account.access_token_ciphertext || !account.token_iv) throw new Error("Reconnect LinkedIn to enable publishing");
          if (account.token_expires_at && new Date(account.token_expires_at).getTime() <= Date.now()) throw new Error("LinkedIn authorization expired. Reconnect to publish.");
          const token = await decryptToken(account.access_token_ciphertext, account.token_iv);
          const { id, url } = await publishLinkedInText(account.platform_user_id, platform === "linkedin_page", token, targetPost.content);
          results.push({ platform, status: "published", platformPostId: id, publishedUrl: url, errorMessage: null });
        } catch (error) {
          results.push({ platform, status: "failed", platformPostId: null, publishedUrl: null, errorMessage: publishError(error) });
        }
        return;
      }
      if (platform === "whatsapp") {
        try {
          const { broadcastId, counts } = await createAndRunBroadcast(supabase, userId, account, {
            text: targetPost.content,
            mediaUrl: targetPost.media_urls?.[0] ?? null,
            postId: post.id,
            options: post.whatsapp_options,
          });
          if (counts.sent === 0 && counts.pending === 0 && counts.queued === 0) {
            throw new Error(`WhatsApp couldn't deliver to any of ${counts.total} recipients — see the WhatsApp tab for per-recipient errors`);
          }
          // Counts as published once any message went out or was handed to the
          // bridge; a partial/in-progress send is reported in the note so it
          // isn't mistaken for full delivery.
          const note =
            counts.failed > 0 || counts.pending > 0 || counts.queued > 0
              ? `Sent ${counts.sent} of ${counts.total}${counts.queued ? `, ${counts.queued} queued to send gradually` : ""}${counts.failed ? `, ${counts.failed} failed` : ""}${counts.pending ? `, ${counts.pending} still pending — resume it in the WhatsApp tab` : ""}`
              : null;
          results.push({ platform, status: "published", platformPostId: broadcastId, publishedUrl: null, errorMessage: note });
        } catch (error) {
          results.push({
            platform,
            status: "failed",
            platformPostId: null,
            publishedUrl: null,
            errorMessage: publishError(error),
          });
        }
        return;
      }

      if (platform === "youtube") {
        if (!account.access_token_ciphertext || !account.token_iv) {
          results.push({
            platform,
            status: "failed",
            platformPostId: null,
            publishedUrl: null,
            errorMessage: "Reconnect YouTube to enable publishing",
          });
          return;
        }
        try {
          const title = targetPost.title || targetPost.content;
          const { id, url } = await publishToYouTube(
            supabase,
            account,
            account.id,
            title,
            targetPost.content,
            targetPost.media_urls ?? [],
          );
          results.push({ platform, status: "published", platformPostId: id, publishedUrl: url, errorMessage: null });
        } catch (error) {
          results.push({
            platform,
            status: "failed",
            platformPostId: null,
            publishedUrl: null,
            errorMessage: publishError(error),
          });
        }
        return;
      }

      // Facebook and Instagram both publish through the Page's own access
      // token (Instagram's Graph API posting is routed through the linked Page).
      if (!account.page_access_token_ciphertext || !account.page_access_token_iv) {
        results.push({
          platform,
          status: "failed",
          platformPostId: null,
          publishedUrl: null,
          errorMessage: `Reconnect ${platform === "facebook" ? "Facebook" : "Instagram"} to enable publishing (this account predates it)`,
        });
        return;
      }

      try {
        const pageToken = await decryptToken(account.page_access_token_ciphertext, account.page_access_token_iv);
        const { id, url } =
          platform === "facebook"
            ? await publishToFacebook(account.platform_user_id, pageToken, targetPost.content, targetPost.media_urls ?? [])
            : await publishToInstagram(account.platform_user_id, pageToken, targetPost.content, targetPost.media_urls ?? []);
        results.push({ platform, status: "published", platformPostId: id, publishedUrl: url, errorMessage: null });
      } catch (error) {
        results.push({
          platform,
          status: "failed",
          platformPostId: null,
          publishedUrl: null,
          errorMessage: publishError(error),
        });
      }
    })();
    // Persist each target before sending the next; a later crash must not
    // lose evidence of earlier successful external side effects.
    const r = allResults.at(-1);
    if (!alreadyPublished && r && r.connectedAccountId === account.id) {
      const { error } = await supabase.from("sv_post_platform_results").insert({
        post_id: post.id,
        user_id: userId,
        connected_account_id: r.connectedAccountId,
        platform: r.platform,
        status: r.status,
        platform_post_id: r.platformPostId,
        published_url: r.publishedUrl,
        error_message: r.errorMessage,
        published_at: r.status === "published" ? new Date().toISOString() : null,
      });
      if (error) throw new Error("Could not record the publish result. Check the platform before retrying.");
    }
  }


  const results = allResults;

  const publishedCount = results.filter((r) => r.status === "published").length;
  const overallStatus: PublishOutcome["overallStatus"] =
    publishedCount === results.length ? "published" : publishedCount > 0 ? "partially_failed" : "failed";
  const { error: statusError } = await supabase
    .from("sv_posts")
    .update({ status: overallStatus, published_at: publishedCount > 0 ? new Date().toISOString() : null })
    .eq("id", post.id);
  if (statusError) throw statusError;

  // Both the manual "Publish now" button and the scheduled-post cron end up
  // here — this is what lets a user actually see whether a *scheduled* post
  // went out, since nothing else notifies them (no active browser tab, no
  // toast) when the cron is what triggered it.
  await supabase.from("sv_activity_log").insert({
    user_id: userId,
    action: overallStatus === "published" ? "post_published" : overallStatus === "partially_failed" ? "post_partially_failed" : "post_failed",
    entity_type: "post",
    entity_id: post.id,
    metadata: {
      title: post.title,
      platforms: results.map((r) => r.platform),
      failed: results.filter((r) => r.status === "failed").map((r) => ({ platform: r.platform, error: r.errorMessage })),
    },
  });

  return { results, overallStatus };
}
