import type { PlanTier } from "@/types/database";

export const APP_NAME = (import.meta.env.VITE_APP_NAME as string | undefined) || "SocialVerse";

export const PLATFORM_COLORS = {
  facebook: "#1877F2",
  instagram: "#E4405F",
  youtube: "#FF0000",
  linkedin: "#0A66C2",
  whatsapp: "#25D366",
} as const;

export interface PlanLimits {
  label: string;
  priceLabel: string;
  maxConnectedAccounts: number;
  maxScheduledPosts: number | null;
  features: string[];
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    label: "Free",
    priceLabel: "₹0",
    maxConnectedAccounts: 4,
    maxScheduledPosts: 10,
    features: ["4 connected accounts", "10 scheduled posts", "Basic analytics"],
  },
  pro: {
    label: "Pro",
    priceLabel: "₹499/mo",
    maxConnectedAccounts: 10,
    maxScheduledPosts: null,
    features: ["10 connected accounts", "Unlimited scheduled posts", "Advanced analytics", "Priority support"],
  },
  business: {
    label: "Business",
    priceLabel: "₹1,499/mo",
    maxConnectedAccounts: 25,
    maxScheduledPosts: null,
    features: ["25 connected accounts", "Unlimited everything", "Team members", "API access"],
  },
};

export const TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];
