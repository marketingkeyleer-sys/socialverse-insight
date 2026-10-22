import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { uploadPostAccountPage, UPLOADPOST_SCOPE } from "./uploadpost.ts";

export function confirmedLinkedInResult(data: any): { id: string; url: string } | null {
  const result = Array.isArray(data.results) ? data.results.find((row: any) => row.platform === "linkedin") : data.results?.linkedin;
  if (!result || result.success !== true || result.skipped || result.status === "queued" || result.status === "processing") return null;
  const address = result.url ?? result.post_url;
  try {
    const url = new URL(address);
    if (url.protocol !== "https:" || url.username || url.password || !(url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com")) || !url.pathname.startsWith("/feed/update/")) return null;
    return { id: String(result.post_id ?? result.platform_post_id ?? url.toString()), url: url.toString() };
  } catch { return null; }
}

export async function publishUploadPostPage(account: any, userId: string, postId: string, content: string, media: string[]) {
  if (account.user_id !== userId) throw new Error("Account belongs to another user");
  const { binding } = await uploadPostAccountPage(account);
  const storage = new URL(Deno.env.get("SUPABASE_URL")!);
  for (const address of media) {
    const url = new URL(address);
    if (url.origin !== storage.origin || url.username || url.password || !url.pathname.startsWith(`/storage/v1/object/public/sv-media/${userId}/`)) throw new Error("Use media uploaded to your own SocialVerse library");
  }
  const videos = media.filter(url => /\.(mp4|mov)(?:\?|$)/i.test(url));
  if (videos.length && (videos.length !== 1 || media.length !== 1)) throw new Error("LinkedIn accepts one video or a collection of images, not mixed attachments");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({postId,accountId:account.id,content,media})));
  const requestId = `sv-${Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2,"0")).join("")}`;
  const form = new FormData();
  form.set("user", binding.profile); form.append("platform[]", "linkedin");
  form.set("title", content); form.set("description", content);
  form.set("target_linkedin_page_id", binding.pageId);
  form.set("async_upload", "true"); form.set("request_id", requestId);
  form.set("external_id", `${postId}:${account.id}`);
  for (const url of media) form.append(videos.length ? "video" : "photos[]", url);
  let response: Response;
  try {
    response = await fetch(`https://api.upload-post.com/api/${videos.length ? "upload" : media.length ? "upload_photos" : "upload_text"}`, {
      method:"POST", headers:{Authorization:`Apikey ${Deno.env.get("UPLOAD_POST_API_KEY")!}`,"Idempotency-Key":requestId},
      body:form,redirect:"error",signal:AbortSignal.timeout(25000),
    });
  } catch { throw new Error(`Outcome unknown. Check Upload-Post before retrying. Request: ${requestId}`); }
  if (!response.ok) {
    if (response.status >= 500) throw new Error(`Outcome unknown. Check Upload-Post before retrying. Request: ${requestId}`);
    throw new Error(response.status === 429 ? "Upload-Post monthly quota or rate limit reached. Check the provider plan before publishing." : `Upload-Post rejected the LinkedIn publish request (${response.status}). Check authorization and provider limits.`);
  }
  const data = await response.json().catch(() => null);
  if (!data || data.success !== true) throw new Error(`Outcome unknown. Check Upload-Post before retrying. Request: ${requestId}`);
  const confirmed = confirmedLinkedInResult(data);
  if (confirmed) return { ...confirmed, requestId, pending:false };
  if (data.results?.linkedin?.success === false) throw new Error("Upload-Post could not publish to the selected LinkedIn Page. Review its provider result.");
  // The receipt is not proof of publication. Cron reconciles the exact job.
  return { id:null, url:null, requestId, pending:true };
}

export async function reconcileUploadPostResults(admin: SupabaseClient) {
  const {data: rows,error} = await admin.from("sv_post_platform_results").select("*").eq("status","publishing").eq("platform","linkedin_page").limit(10);
  if (error) throw new Error("Could not load pending LinkedIn publishing results");
  const touched = new Set<string>();
  await Promise.all((rows ?? []).map(async (row: any) => {
    const requestId = row.engagement_data?.uploadpost_request_id;
    if (typeof requestId !== "string" || !/^sv-[a-f0-9]{64}$/.test(requestId)) return;
    const {data: account} = await admin.from("sv_connected_accounts").select("*").eq("id",row.connected_account_id).eq("user_id",row.user_id).maybeSingle();
    if (!account?.scopes?.includes(UPLOADPOST_SCOPE)) return;
    try {
      await uploadPostAccountPage(account);
      const response = await fetch(`https://api.upload-post.com/api/uploadposts/status?request_id=${encodeURIComponent(requestId)}`, {headers:{Authorization:`Apikey ${Deno.env.get("UPLOAD_POST_API_KEY")!}`},redirect:"error",signal:AbortSignal.timeout(12000)});
      if (!response.ok) return;
      const data = await response.json();
      if (data.request_id !== requestId || data.external_id !== `${row.post_id}:${row.connected_account_id}`) return;
      const confirmed = confirmedLinkedInResult(data);
      if (!confirmed && data.status !== "failed") return;
      const {error: updateError} = await admin.from("sv_post_platform_results").update({status:confirmed ? "published" : "failed",platform_post_id:confirmed?.id ?? null,published_url:confirmed?.url ?? null,published_at:confirmed ? new Date().toISOString() : null,error_message:confirmed ? null : "Outcome unknown. Check Upload-Post before retrying. The provider reports failure or inactivity; confirm no post exists first."}).eq("id",row.id).eq("status","publishing");
      if (!updateError) touched.add(row.post_id);
    } catch { /* A provider outage must not trigger a duplicate publication. */ }
  }));
  for (const postId of touched) {
    const {data: results,error: resultsError} = await admin.from("sv_post_platform_results").select("status,connected_account_id,created_at").eq("post_id",postId).order("created_at",{ascending:false});
    if (resultsError || !results?.length) continue;
    const byAccount = new Map<string, any>();
    for (const result of results) if (!byAccount.has(result.connected_account_id)) byAccount.set(result.connected_account_id, result);
    const latest = [...byAccount.values()];
    const pending = latest.some(result => result.status === "publishing" || result.status === "pending");
    const published = latest.filter(result => result.status === "published").length;
    const status = pending ? "publishing" : published === latest.length ? "published" : published ? "partially_failed" : "failed";
    await admin.from("sv_posts").update({status,published_at:published ? new Date().toISOString() : null}).eq("id",postId).eq("status","publishing");
  }
}
