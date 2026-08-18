import {
  errorResult,
  usableAccessToken,
  type ConnectedAccountRow,
  type PostTargetRow,
  type PublishResult,
  type ScheduledPostRow,
} from "@/lib/publish/shared.server";

// YouTube has no lightweight "post" — the only publish capability is a video
// upload (resumable protocol), optionally with a scheduled release via
// status.publishAt. Streams the file from Supabase Storage straight into the
// upload PUT instead of buffering it, to stay under Worker memory limits.
export async function publishYouTube(
  account: ConnectedAccountRow,
  target: PostTargetRow,
  post: ScheduledPostRow,
): Promise<PublishResult> {
  try {
    if (!post.media_url || post.media_type !== "video") {
      return { error: "YouTube requires a video file." };
    }
    const options = target.platform_options as { title?: string; description?: string };
    const title = options.title?.trim();
    if (!title) return { error: "YouTube requires a title." };
    const description = options.description ?? post.content ?? "";

    const token = await usableAccessToken(account);

    const headRes = await fetch(post.media_url, { method: "HEAD" });
    if (!headRes.ok) return { error: `Could not read the uploaded video (${headRes.status}).` };
    const contentLength = headRes.headers.get("content-length");
    const contentType = headRes.headers.get("content-type") ?? "video/mp4";
    if (!contentLength) return { error: "Could not determine video file size for upload." };

    const isFuture = post.scheduled_at ? new Date(post.scheduled_at).getTime() > Date.now() : false;
    const status: Record<string, unknown> = { privacyStatus: isFuture ? "private" : "public" };
    if (isFuture) status.publishAt = post.scheduled_at;

    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": contentType,
          "X-Upload-Content-Length": contentLength,
        },
        body: JSON.stringify({ snippet: { title, description }, status }),
      },
    );
    if (!initRes.ok) {
      const json: { error?: { message?: string } } = await initRes.json().catch(() => ({}));
      const message =
        json?.error?.message ?? `YouTube upload session could not start (${initRes.status})`;
      const hint =
        initRes.status === 403
          ? " — reconnect YouTube to grant upload permission (youtube.upload)."
          : "";
      return { error: `${message}${hint}` };
    }
    const sessionUrl = initRes.headers.get("location");
    if (!sessionUrl) return { error: "YouTube did not return an upload session URL." };

    const sourceRes = await fetch(post.media_url);
    if (!sourceRes.ok || !sourceRes.body) {
      return { error: `Could not stream the uploaded video (${sourceRes.status}).` };
    }

    const putInit: RequestInit & { duplex?: "half" } = {
      method: "PUT",
      headers: { "Content-Length": contentLength, "Content-Type": contentType },
      body: sourceRes.body,
      // Required by the Fetch spec for a streamed (ReadableStream) request body.
      duplex: "half",
    };
    const putRes = await fetch(sessionUrl, putInit);

    if (!putRes.ok) {
      const json: { error?: { message?: string } } = await putRes.json().catch(() => ({}));
      return { error: json?.error?.message ?? `YouTube upload failed (${putRes.status})` };
    }
    const video: { id: string } = await putRes.json();
    return {
      providerPostId: video.id,
      providerPostUrl: `https://www.youtube.com/watch?v=${video.id}`,
    };
  } catch (error) {
    return errorResult(error);
  }
}
