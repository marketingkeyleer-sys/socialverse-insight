import type { PlatformId } from "@/lib/oauth/providers.server";
import { publishFacebook } from "@/lib/publish/facebook.server";
import { publishInstagram } from "@/lib/publish/instagram.server";
import { publishLinkedIn } from "@/lib/publish/linkedin.server";
import { publishYouTube } from "@/lib/publish/youtube.server";
import type {
  ConnectedAccountRow,
  PostTargetRow,
  PublishResult,
  ScheduledPostRow,
} from "@/lib/publish/shared.server";

type Publisher = (
  account: ConnectedAccountRow,
  target: PostTargetRow,
  post: ScheduledPostRow,
) => Promise<PublishResult>;

const notSupported =
  (name: string): Publisher =>
  async () => ({ error: `${name} publishing is not supported yet.` });

export const PUBLISHERS: Record<PlatformId, Publisher> = {
  facebook: publishFacebook,
  instagram: publishInstagram,
  linkedin: publishLinkedIn,
  youtube: publishYouTube,
  tiktok: notSupported("TikTok"),
  x: notSupported("X"),
};
