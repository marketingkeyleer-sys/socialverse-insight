// Pure policy functions, shared with the offline regression tests.
export function safeRedirect(target: unknown, appUrl: string, allowedOrigins = ""): string {
  const fallback = new URL("/accounts", appUrl);
  const allowed = new Set([fallback.origin, ...allowedOrigins.split(",").filter(Boolean).map((s) => new URL(s.trim()).origin)]);
  const url = typeof target === "string" ? new URL(target, fallback) : fallback;
  if (!allowed.has(url.origin) || !["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("OAuth return URL is not allowed. Configure APP_URL and OAUTH_ALLOWED_ORIGINS.");
  }
  for (const key of ["connected", "connectedCount", "connect_error", "platform", "connection_request"]) url.searchParams.delete(key);
  url.hash = "";
  return url.toString();
}

export function grantedScopes(scope: unknown): string[] {
  return typeof scope === "string" ? [...new Set(scope.split(/[, ]+/).filter(Boolean))] : [];
}

export function validateSelection<T extends { platform_user_id: string }>(rows: T[], ids: unknown): T[] {
  if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length) {
    throw new Error("Select at least one account, without duplicates.");
  }
  const selected = rows.filter((row) => ids.includes(row.platform_user_id));
  if (selected.length !== ids.length) throw new Error("An account was not authorized by this connection request.");
  return selected;
}
