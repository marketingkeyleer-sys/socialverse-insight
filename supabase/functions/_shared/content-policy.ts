export interface PlatformDraft { content: string; title?: string; media_urls?: string[] }
interface ContentPost { content: string; title?: string | null; media_urls?: string[] | null; platform_content?: unknown }

export function platformPostContent(post: ContentPost, platform: string) {
  const variants = post.platform_content;
  const variant = variants && typeof variants === "object" && !Array.isArray(variants)
    ? (variants as Record<string, unknown>)[platform] : undefined;
  if (variant === undefined) return { ...post, content: post.content, title: post.title, media_urls: post.media_urls ?? [] };
  if (!variant || typeof variant !== "object" || Array.isArray(variant)) throw new Error(`Invalid content for ${platform}`);
  const draft = variant as Record<string, unknown>;
  if (typeof draft.content !== "string") throw new Error(`Add a caption for ${platform}`);
  if (draft.title !== undefined && typeof draft.title !== "string") throw new Error(`Invalid title for ${platform}`);
  if (draft.media_urls !== undefined && (!Array.isArray(draft.media_urls) || draft.media_urls.some((url) => typeof url !== "string"))) throw new Error(`Invalid media for ${platform}`);
  return { ...post, content: draft.content, title: (draft.title as string | undefined) ?? post.title, media_urls: (draft.media_urls as string[] | undefined) ?? post.media_urls ?? [] };
}

export function validatePlatformDraft(platform: string, draft: { content: string; title?: string | null; media_urls: string[] }) {
  const limits: Record<string, number> = { facebook: 63206, instagram: 2200, linkedin: 3000, linkedin_page: 3000, youtube: 5000, whatsapp: 1024 };
  if (draft.content.length > (limits[platform] ?? 5000)) throw new Error(`${platform}: caption exceeds the ${limits[platform] ?? 5000} character limit`);
  if (!draft.content.trim() && !draft.media_urls.length) throw new Error(`${platform}: add text or media`);
  if (platform === "instagram" && !draft.media_urls.length) throw new Error("Instagram requires an image or video");
  if (platform === "youtube" && !draft.media_urls.some((url) => /\.(mp4|mov)(?:\?|$)/i.test(url))) throw new Error("YouTube requires an MP4 or MOV video");
  if (platform === "youtube" && (draft.title?.length ?? 0) > 100) throw new Error("YouTube titles must be 100 characters or fewer");
}
