import {
  errorResult,
  usableAccessToken,
  type ConnectedAccountRow,
  type PostTargetRow,
  type PublishResult,
  type ScheduledPostRow,
} from "@/lib/publish/shared.server";

const LI_VERSION = "202401";

function linkedInFetch(url: string, token: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": LI_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function uploadLinkedInImage(
  token: string,
  authorUrn: string,
  imageUrl: string,
): Promise<string> {
  const initRes = await linkedInFetch(
    "https://api.linkedin.com/rest/images?action=initializeUpload",
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
    },
  );
  const initJson: { value?: { uploadUrl: string; image: string }; message?: string } = await initRes
    .json()
    .catch(() => ({}));
  if (!initRes.ok || !initJson.value)
    throw new Error(initJson?.message ?? `LinkedIn image init failed (${initRes.status})`);
  const uploadUrl = initJson.value.uploadUrl;
  const imageUrn = initJson.value.image;

  const mediaRes = await fetch(imageUrl);
  if (!mediaRes.ok)
    throw new Error(`Could not fetch media for LinkedIn upload (${mediaRes.status})`);
  const bytes = await mediaRes.arrayBuffer();
  const putRes = await fetch(uploadUrl, { method: "PUT", body: bytes });
  if (!putRes.ok) throw new Error(`LinkedIn image upload failed (${putRes.status})`);

  return imageUrn;
}

export async function publishLinkedIn(
  account: ConnectedAccountRow,
  target: PostTargetRow,
  post: ScheduledPostRow,
): Promise<PublishResult> {
  try {
    const token = await usableAccessToken(account);
    const options = target.platform_options as {
      authorType?: "member" | "organization";
      organizationId?: string;
    };
    const authorUrn =
      options.authorType === "organization" && options.organizationId
        ? `urn:li:organization:${options.organizationId}`
        : `urn:li:person:${account.provider_account_id}`;

    let mediaUrn: string | undefined;
    if (post.media_url && post.media_type === "image") {
      mediaUrn = await uploadLinkedInImage(token, authorUrn, post.media_url);
    } else if (post.media_url && post.media_type === "video") {
      return { error: "LinkedIn video posts are not supported yet." };
    }

    const body: Record<string, unknown> = {
      author: authorUrn,
      commentary: post.content,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
    };
    if (mediaUrn) body.content = { media: { id: mediaUrn } };

    const res = await linkedInFetch("https://api.linkedin.com/rest/posts", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json: { message?: string } = await res.json().catch(() => ({}));
      const message = json?.message ?? `LinkedIn post failed (${res.status})`;
      const hint =
        res.status === 403
          ? " — reconnect LinkedIn to grant posting permission (w_member_social/w_organization_social)."
          : "";
      return { error: `${message}${hint}` };
    }
    const providerPostId = res.headers.get("x-restli-id") ?? "";
    return {
      providerPostId,
      providerPostUrl: providerPostId
        ? `https://www.linkedin.com/feed/update/${encodeURIComponent(providerPostId)}`
        : undefined,
    };
  } catch (error) {
    return errorResult(error);
  }
}
