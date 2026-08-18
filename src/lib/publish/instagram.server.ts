import {
  GRAPH_VERSION,
  errorResult,
  getFacebookPage,
  graphFetch,
  type ConnectedAccountRow,
  type PostTargetRow,
  type PublishResult,
  type ScheduledPostRow,
} from "@/lib/publish/shared.server";

const POLL_DELAYS_MS = [2000, 4000, 8000, 6000]; // ~20s total cap

async function waitForContainer(
  igUserId: string,
  creationId: string,
  token: string,
): Promise<void> {
  for (const delay of POLL_DELAYS_MS) {
    const json = await graphFetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${creationId}?fields=status_code&access_token=${token}`,
    );
    if (json.status_code === "FINISHED") return;
    if (json.status_code === "ERROR") throw new Error("Instagram media processing failed.");
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error("Instagram media processing timed out.");
}

export async function publishInstagram(
  account: ConnectedAccountRow,
  _target: PostTargetRow,
  post: ScheduledPostRow,
): Promise<PublishResult> {
  try {
    if (!post.media_url)
      return { error: "Instagram requires an image (text-only posts aren't supported)." };
    if (post.media_type === "video")
      return { error: "Instagram video posts are not supported yet." };

    const page = await getFacebookPage(account, { withInstagram: true });
    if (!page?.instagramBusinessAccountId) {
      return {
        error: "No Instagram Business/Creator account found — reconnect Instagram to select one.",
      };
    }
    const igUserId = page.instagramBusinessAccountId;
    const token = page.pageAccessToken;

    const container = await graphFetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          image_url: post.media_url,
          caption: post.content,
          access_token: token,
        }),
      },
    );
    const creationId = container.id;
    if (!creationId) return { error: "Instagram did not return a media container id." };

    await waitForContainer(igUserId, creationId, token);

    const published = await graphFetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ creation_id: creationId, access_token: token }),
      },
    );

    let providerPostUrl: string | undefined;
    try {
      const permalink = await graphFetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${published.id}?fields=permalink&access_token=${token}`,
      );
      providerPostUrl = permalink.permalink;
    } catch {
      providerPostUrl = undefined;
    }

    return { providerPostId: published.id, providerPostUrl };
  } catch (error) {
    return errorResult(error);
  }
}
