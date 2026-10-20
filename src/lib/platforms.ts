import { Facebook, Instagram, Linkedin, Whatsapp, Youtube } from "@/components/icons/BrandIcons";
import { PLATFORM_COLORS } from "@/lib/constants";
import type { Platform, PlatformConfig } from "@/types/platform";

export const PLATFORM_CONFIGS: PlatformConfig[] = [
  { id: "facebook", label: "Facebook", color: PLATFORM_COLORS.facebook, icon: Facebook, characterLimit: 63206 },
  { id: "instagram", label: "Instagram", color: PLATFORM_COLORS.instagram, icon: Instagram, characterLimit: 2200 },
  { id: "youtube", label: "YouTube", color: PLATFORM_COLORS.youtube, icon: Youtube, characterLimit: 5000 },
  { id: "linkedin", label: "LinkedIn", color: PLATFORM_COLORS.linkedin, icon: Linkedin, characterLimit: 3000 },
  { id: "linkedin_page", label: "LinkedIn Page", color: PLATFORM_COLORS.linkedin, icon: Linkedin, characterLimit: 3000 },
  // 1024 is the cap on a template body variable — see sanitizeTemplateParam.
  { id: "whatsapp", label: "WhatsApp", color: PLATFORM_COLORS.whatsapp, icon: Whatsapp, characterLimit: 1024 },
];

const BY_ID = new Map(PLATFORM_CONFIGS.map((p) => [p.id, p]));

export const PLATFORM_DETAILS: Record<Platform, { caption: string; website: string }> = {
  facebook: { caption: "Page updates, community content and audience insights.", website: "https://www.facebook.com/" },
  instagram: { caption: "Visual stories, image posts and creator performance.", website: "https://www.instagram.com/" },
  youtube: { caption: "Channel videos, subscribers and video analytics.", website: "https://www.youtube.com/" },
  linkedin: { caption: "Professional updates for your personal profile.", website: "https://www.linkedin.com/" },
  linkedin_page: { caption: "Company-page content and business communications.", website: "https://www.linkedin.com/" },
  whatsapp: { caption: "Customer conversations and business broadcasts.", website: "https://www.whatsapp.com/" },
};

export function getPlatformConfig(id: Platform): PlatformConfig {
  const config = BY_ID.get(id);
  if (!config) throw new Error(`Unknown platform: ${id}`);
  return config;
}

export function getPlatformIcon(id: Platform) {
  return getPlatformConfig(id).icon;
}

export function getPlatformColor(id: Platform): string {
  if (id === "linkedin_page") return "#7356b5";
  return getPlatformConfig(id).color;
}

export function getPlatformCharLimit(id: Platform): number {
  return getPlatformConfig(id).characterLimit;
}

export function getPlatformLabel(id: Platform): string {
  return getPlatformConfig(id).label;
}
