export type PersonalPlatform = "facebook" | "instagram";
export const PERSONAL_PLATFORMS = {
  facebook: { label: "Facebook personal profile", url: "https://www.facebook.com/" },
  instagram: { label: "Instagram personal account", url: "https://www.instagram.com/" },
} as const;

export function manualPlatform(tags: string[] | null | undefined): PersonalPlatform | null {
  if (tags?.includes("manual:facebook")) return "facebook";
  if (tags?.includes("manual:instagram")) return "instagram";
  return null;
}

export function manualDraft(platform: PersonalPlatform, content: string, title: string, media: string[], brandId: string | null) {
  if (!content.trim() && !media.length) throw new Error("Add a caption or media before saving.");
  return { brand_id: brandId, content, title: title.trim() || null, media_urls: media,
    tags: [`manual:${platform}`], platforms: [], connected_account_ids: [],
    platform_content: {}, status: "draft" as const, scheduled_at: null, published_at: null };
}

const calendarText = (text: string) => text.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
function foldLine(line: string) {
  let result = "", bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > 75) { result += "\r\n "; bytes = 1; }
    result += char; bytes += size;
  }
  return result;
}

export function manualReminder(at: Date, platform: PersonalPlatform, draftId: string, appUrl: string, now = new Date()) {
  if (!Number.isFinite(at.getTime()) || at.getTime() <= now.getTime()) throw new Error("Choose a future reminder time.");
  const timestamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const link = new URL("/manual-publish", appUrl);
  link.searchParams.set("id", draftId);
  const uid = encodeURIComponent(draftId);
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SocialVerse//Manual publishing//EN", "BEGIN:VEVENT",
    `UID:manual-${uid}-${timestamp(at)}@socialverse`, `DTSTAMP:${timestamp(now)}`, `DTSTART:${timestamp(at)}`,
    `DTEND:${timestamp(new Date(at.getTime() + 15 * 60_000))}`,
    `SUMMARY:${calendarText(`Publish your ${PERSONAL_PLATFORMS[platform].label} draft`)}`,
    `DESCRIPTION:${calendarText(`Open SocialVerse, copy the caption and publish manually. ${link.toString()}`)}`,
    "BEGIN:VALARM", "TRIGGER:-PT5M", "ACTION:DISPLAY", "DESCRIPTION:Prepare your personal-account post",
    "END:VALARM", "END:VEVENT", "END:VCALENDAR", ""].map(foldLine).join("\r\n");
}
