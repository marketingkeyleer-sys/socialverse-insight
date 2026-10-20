import type { ConnectedAccount, Platform } from "@/types/database";

export type HealthLevel = "ok" | "attention";

export interface AccountHealth {
  level: HealthLevel;
  // Short label for the badge and the plain-language fix shown under it.
  label?: string;
  fix?: string;
  // What the Fix button should do. "reconnect" re-runs the platform login,
  // "link" sends the user to finish scanning WhatsApp's QR code.
  action?: "reconnect" | "link";
}

const SYNCED = new Set<Platform>(["facebook", "instagram", "youtube"]);

// Works out, from data already on the row, whether an account needs the
// user's attention — so problems show up as a clear badge and a fix button
// instead of a silent failure discovered days later.
export function getAccountHealth(account: ConnectedAccount, now = Date.now()): AccountHealth {
  const platform = account.platform as Platform;

  if (platform === "whatsapp") {
    if (account.metadata?.mode === "bridge" && !account.platform_username) {
      return { level: "attention", label: "Finish linking", fix: "Scan the QR code to link your WhatsApp number.", action: "link" };
    }
    if (account.metadata?.quality_rating === "RED") {
      return {
        level: "attention",
        label: "Quality rating red",
        fix: "WhatsApp may limit or block your messages. Pause broadcasts and check Meta's quality dashboard.",
      };
    }
    return { level: "ok" };
  }

  if (account.token_expires_at && new Date(account.token_expires_at).getTime() < now) {
    return {
      level: "attention",
      label: "Login expired",
      fix: "The connection has expired. Reconnect to keep syncing and publishing.",
      action: "reconnect",
    };
  }

  if (SYNCED.has(platform) && account.last_synced_at) {
    const expectedMs = Math.max(account.sync_interval_minutes * 3, 24 * 60) * 60_000;
    if (now - new Date(account.last_synced_at).getTime() > expectedMs) {
      return {
        level: "attention",
        label: "Sync is behind",
        fix: "This account hasn't synced recently. Try Sync now, and reconnect if it keeps failing.",
        action: "reconnect",
      };
    }
  }

  return { level: "ok" };
}
