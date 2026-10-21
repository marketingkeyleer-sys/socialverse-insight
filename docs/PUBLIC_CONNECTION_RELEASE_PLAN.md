# SocialVerse: general-user connections

## Intended customer flow

1. Register/sign in to SocialVerse with email and password. Confirm email if Supabase requires it.
2. Create a brand for the customer's company, or choose an existing brand they own.
3. Connect a supported platform through its official consent screen. SocialVerse never asks for the social account's password.
4. Choose the authorized Page/channel/account in SocialVerse and confirm it for the chosen brand.
5. View that brand's accounts and reports. Repeat in separate brand workspaces for other companies.

Users can complete onboarding without a connected account. Provider errors or incomplete app approval must not trap customers in setup. The selected brand and setup step survive same-tab OAuth round trips, with storage isolated by SocialVerse user ID. Only navigation choices are saved; provider credentials are not stored in browser navigation storage.

## Account types supported by the current implementation

| Platform | Customer account | Destination managed by SocialVerse |
| --- | --- | --- |
| Facebook | A Facebook identity with the necessary Page access | Its authorized Facebook Pages, not a personal-profile timeline |
| Instagram | Business or Creator account linked to a managed Facebook Page | That professional Instagram account through Facebook Login |
| YouTube | Google identity authorized for a channel | The selected YouTube channel |
| LinkedIn | LinkedIn member | The member profile; organization Pages use the separate LinkedIn Page route and approvals |
| WhatsApp | Official business Cloud API configuration | Business phone number; personal-account QR linking requires a separately deployed bridge |

Personal Instagram consumer accounts cannot use the implemented professional API route. Direct Instagram Login without a Facebook Page is a different integration and is not implemented here. A brand currently supports one account per platform; additional accounts use another brand or Unassigned accounts, subject to the user's plan. Do not promise unrestricted account types or unlimited plan capacity for every user.

## Production Meta app: confirmed owner inspection

Production app is Dhivya **975939348747280**, not the similarly named unpublished app. Owner inspection confirmed:

- Published status and no immediate required-action items.
- Client OAuth login and Web OAuth login enabled. HTTPS and exact redirect matching enabled.
- Valid Facebook redirect: `https://igdbgaroizwqaphdhimd.supabase.co/functions/v1/oauth-callback/facebook`.
- Valid Instagram redirect: `https://igdbgaroizwqaphdhimd.supabase.co/functions/v1/oauth-callback/instagram`.
- Basic Facebook configuration: **1150403161000124**. Instagram configuration: **2165851084004173**.
- public_profile, pages_show_list and pages_read_engagement show **Ready for testing**. The public_profile Actions menu offers **Go to App Review**, not an immediate public-access toggle.
- Review draft **975946602079888** is **Not submitted**; its Submit for review button is disabled. All 25 requests remain, as instructed by the owner.

An unrelated Facebook identity reached Meta but received “Facebook Login is currently unavailable for this app…” before consent or asset selection. Its new Page cannot be discovered until authorization succeeds. Existing app-role authorization/discovery passed previously. This is not evidence that external-customer access is approved.

To release public Meta connections, supply working isolated SocialVerse reviewer access, truthful allowed-use answers and genuine feature recordings for the retained requests, complete required attestations with the owner's confirmation, submit the enabled review and obtain approval. Several retained features (such as fundraising, catalogs, Threads, Ads MCP and live streaming) do not have established working implementations or evidence. They cannot be certified by describing the basic Facebook/Instagram connection flow. A new Meta developer account or a shared access token does not grant approval to the existing app.

## Google and other external release work

- Google OAuth Production and verification are separate. Complete verification of the scopes actually requested to resolve the unverified-app warning and applicable user limits.
- Enable YouTube Analytics API only after the owner confirms the API enablement/terms step. Analytics enablement does not replace OAuth verification.
- Recheck each platform's approved products, scopes and callbacks against the deployed application.
- Existing exposed tokens/administrative keys must be revoked or replaced privately by the owner; none are copied into this plan or used for these frontend changes.

## Acceptance gates

| Check | Evidence / remaining gate |
| --- | --- |
| Signup, brand setup, connect-later, OAuth return navigation | Source implementation and build/regression checks; real new-user walkthrough still required |
| User/brand isolation | Automated two-user state/asset/publishing tests; live two-user database run remains required |
| Facebook/Instagram app-role callback and picker | Previously passed with real owner assets; temporary choices cancelled |
| Facebook external customer | Blocked by Meta before callback; retest after approval |
| Dedicated SocialVerse reviewer login | Last supplied login returned Invalid login credentials; new Facebook registration does not create a SocialVerse login |
| YouTube independent channel | Provider discovery and refresh covered by automated tests; independent-user live authorization remains required |
| Hosted deployment | Local build and GitHub push do not prove Lovable publication. Verify hosted preview and publish result separately |

No database migrations, schema resets or existing-account moves are needed for the onboarding changes in this release.
