export function publishingAccessIssue(account: { platform: string; scopes?: string[] | null; is_active?: boolean }): string | null {
  if (account.is_active === false) return "Reconnect this account before publishing";
  const scopes = account.scopes ?? [];
  if (!scopes.length) return null; // Older connections must be verified by the provider itself.
  const required: Record<string, string[]> = {
    facebook: ["pages_manage_posts"], instagram: ["instagram_content_publish", "instagram_business_content_publish"],
    linkedin: ["w_member_social"], linkedin_page: ["w_organization_social", "socialverse:upload-post"],
    youtube: ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube", "https://www.googleapis.com/auth/youtube.force-ssl"],
  };
  const accepted = required[account.platform];
  return accepted && !accepted.some(scope => scopes.includes(scope))
    ? `${account.platform.replace("_", " ")}: publishing permission is missing. Your administrator must enable approved publishing access, then reconnect this account.` : null;
}
