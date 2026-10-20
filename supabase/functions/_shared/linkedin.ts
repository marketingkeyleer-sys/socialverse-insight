export async function publishLinkedInText(authorId: string, organization: boolean, token: string, text: string) {
  if (!text.trim() || text.length > 3000) throw new Error("LinkedIn posts require 1–3000 characters");
  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`, "Content-Type": "application/json",
      "LinkedIn-Version": Deno.env.get("LINKEDIN_API_VERSION") ?? "202609",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: `urn:li:${organization ? "organization" : "person"}:${authorId}`,
      commentary: text, visibility: "PUBLIC", lifecycleState: "PUBLISHED",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!response.ok) {
    if (response.status === 403) throw new Error("LinkedIn publishing permission is missing. Enable the appropriate product and reconnect with w_member_social or w_organization_social.");
    throw new Error(`LinkedIn publishing failed (HTTP ${response.status}). Check the account permissions and API version.`);
  }
  const id = response.headers.get("x-restli-id");
  if (!id) throw new Error("Outcome unknown. LinkedIn accepted the post but returned no ID. Check LinkedIn before retrying.");
  return { id, url: `https://www.linkedin.com/feed/update/${encodeURIComponent(id)}` };
}
