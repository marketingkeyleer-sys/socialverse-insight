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

export function metaConnectionError(code: string | null, reason: string | null): string {
  if (code === "access_denied" || reason === "user_denied") {
    return "Meta did not authorize this connection. If you cancelled, try again and select the Page or professional Instagram account you manage. If Meta says the app is unavailable, the application owner must complete Meta App Review; changing your account will not remove that restriction.";
  }
  if (code === "temporarily_unavailable" || code === "server_error") {
    return "Meta is temporarily unavailable. Please wait a few minutes and try again.";
  }
  return "Meta could not authorize this connection. The application owner must check the login configuration, approved permissions and callback URL. A normal Facebook login can connect managed Pages; Instagram requires a Business or Creator account linked to a Page for this connection method.";
}

export function validateSelection<T extends { platform_user_id: string }>(rows: T[], ids: unknown): T[] {
  if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length) {
    throw new Error("Select at least one account, without duplicates.");
  }
  const selected = rows.filter((row) => ids.includes(row.platform_user_id));
  if (selected.length !== ids.length) throw new Error("An account was not authorized by this connection request.");
  return selected;
}
