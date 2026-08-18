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

export async function publishFacebook(
  account: ConnectedAccountRow,
  _target: PostTargetRow,
  post: ScheduledPostRow,
): Promise<PublishResult> {
  try {
    const page = await getFacebookPage(account);
    if (!page) return { error: "No Facebook Page connected — reconnect Facebook to select one." };

    if (post.media_url && post.media_type === "image") {
      const json = await graphFetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${page.pageId}/photos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            url: post.media_url,
            caption: post.content,
            access_token: page.pageAccessToken,
          }),
        },
      );
      const postId = json.post_id ?? json.id;
      return { providerPostId: postId, providerPostUrl: `https://www.facebook.com/${postId}` };
    }

    if (post.media_url && post.media_type === "video") {
      return { error: "Facebook video posts are not supported yet." };
    }

    const json = await graphFetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${page.pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ message: post.content, access_token: page.pageAccessToken }),
      },
    );
    return { providerPostId: json.id, providerPostUrl: `https://www.facebook.com/${json.id}` };
  } catch (error) {
    return errorResult(error);
  }
}
