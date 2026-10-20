export function accountReturnUrl(currentHref: string, appUrl: string): string {
  const current = new URL(currentHref);
  const application = new URL(appUrl);
  const approvedLocalOrigins = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);
  if (current.origin === application.origin || approvedLocalOrigins.has(current.origin)) return current.toString();
  // Preview domains are not added to the production OAuth origin allowlist.
  // Complete account authorization on the already approved published app.
  return new URL("/accounts", application).toString();
}

export function loginReturnPath(from: { pathname?: string; search?: string } | undefined): string {
  const path = from?.pathname;
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path === "/login") return "/dashboard";
  return path + (from?.search?.startsWith("?") ? from.search : "");
}

export function signInReturnUrl(origin: string, path = "/dashboard"): string {
  const url = new URL(path, origin);
  if (url.origin !== new URL(origin).origin) throw new Error("Sign-in return URL must stay on this application");
  return url.toString();
}
