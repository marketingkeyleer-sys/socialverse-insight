# SocialVerse connection audit — 20 October 2026

## Verified installation

- Application: https://socialverse-insight.lovable.app
- Supabase: igdbgaroizwqaphdhimd. The CLI lists all 19 application functions as ACTIVE.
- Secret-name inventory confirms configured Meta, Google, LinkedIn member and organization credentials, encryption and return-origin configuration. Values were not displayed. No platform-specific OAuth scope overrides are present.
- WhatsApp QR bridge URL/key are absent from the secret-name inventory. Cloud API accepts each business's authorized credentials separately.
- Production Meta app: Dhivya, 975939348747280. Published with a verified business; App Review still has incomplete allowed-usage evidence and disabled submission. See META_REVIEW_PACKET.md.

## Fixed

- Guided YouTube, LinkedIn member and LinkedIn Page connections in Accounts and onboarding; explains account eligibility, permission review, brand destination and confirmation.
- All Accounts entry points honor known unavailable-provider status before authorization. Meta's setup guide also blocks continuing when credentials are unavailable.
- WhatsApp defaults to official Cloud API. Unavailable QR service cannot be started. Webhook instructions use the resolved application Supabase project rather than a potentially mismatched Lovable environment variable.
- YouTube discovery retains all channels returned by authorization, follows pagination and deduplicates IDs. This does not grant access to channels not authorized by Google.
- Meta pagination rejects untrusted origins, embedded credentials, repeated URLs and excessive pages. Discovery calls have timeouts.
- Discovery distinguishes expired/revoked authorization, permission denial and rate limits without reflecting raw provider errors or tokens.
- Active accounts expose Review access / reconnect in their menu.
- Unrecognized platform values in OAuth result URLs cannot crash the Accounts page.
- Connection-storage failures tell the user to contact the administrator rather than instructing users to run a migration.

No schema, data, credential value, role or OAuth permission was changed in this work. No live social posts, ads or messages were sent for testing.

## Remaining provider and product requirements

| Platform | Supported route | What code changes alone cannot complete |
| --- | --- | --- |
| Facebook | Facebook Login selecting managed Pages | Advanced-access review, controlled OAuth/feature recordings; personal profiles are not publishing destinations |
| Instagram | Facebook Login, professional Business/Creator account linked to a Page | Meta review; personal consumer accounts are unsupported by this API; direct Instagram Login is a separate unimplemented route |
| YouTube | Google OAuth and explicit channel confirmation | Google app verification; authorization to each channel; upload quota and channel restrictions |
| LinkedIn member | OpenID profile connection | Share on LinkedIn product and w_member_social grant are required for posts; default scopes currently only request identity |
| LinkedIn Page | Administrator asset discovery | Community Management API product approval and granted organization permissions; not live-verified |
| WhatsApp | Official Cloud API with approved templates | Business onboarding, authorized WABA/number/token and opted-in recipients; automatic Embedded Signup is not implemented |

Meta connection scopes default to read-only identity/discovery. Publishing, deeper insights and messaging need their own approved and granted permissions. A configured client ID/secret is not evidence of customer-wide provider approval. Do not expand permissions merely to hide a feature error.

Not implemented by this work: new platforms such as TikTok/X/Pinterest, direct Instagram Login, WhatsApp Embedded Signup, fundraising, catalogs, Threads or Live Video. Existing broad review requests remain at the owner's instruction; do not certify features that are absent.

## Validation

43 automated tests passed, including new mocked provider discovery pagination, channel preservation, untrusted-origin rejection, cycle limits and safe actionable error tests. The existing cross-user/brand isolation tests passed. Frontend production build and Edge Function type-check passed. Lint has no errors; existing warnings remain. Provider tests are simulations, not successful real-customer connections.

Sources: Meta's official Instagram API collection https://www.postman.com/meta/instagram/folder/u4g5a2a/instagram-api-with-facebook-login ; LinkedIn Share on LinkedIn https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin ; Google OAuth https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps
