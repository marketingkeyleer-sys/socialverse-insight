# New-user connection audit — 21 October 2026

## Scope and evidence

Reviewed email signup/login, onboarding, brand creation, OAuth start/callback, asset selection and server confirmation for Facebook, Instagram and YouTube. No database migration, credential rotation, permission expansion, post publication or account reassignment was performed.

- Existing 45 automated tests passed outside the sandbox. Coverage includes cross-user OAuth requests, foreign-brand rejection, one-time state consumption, credential encryption, authorized asset selection, per-brand reporting and YouTube token refresh. These tests use provider/database doubles; they do not establish public-user provider approval or live database policies.
- Production browser is signed in to the existing administrator account, not the dedicated reviewer account. Its Robotverse brand shows Facebook, Instagram and YouTube records; Mani has no connected accounts. Switching to Mani showed zero accounts, without leaking Robotverse counts into it.
- A new Facebook OAuth request from Mani used production app 975939348747280, Facebook configuration 1150403161000124, and public_profile/pages_show_list/pages_read_engagement. The flow reached Meta successfully.
- Selected “Log into another account” and attempted the owner-supplied alternative Facebook identity. Meta stopped login at a CAPTCHA/security checkpoint. External-user authorization, asset discovery and connection persistence remain unverified pending private user completion. No password or login identifier is recorded in this document.
- Prior owner/app-role Facebook and Instagram round trips returned real account pickers successfully; see META_CONNECTION_FIX_20261021.md. This is distinct from public-customer testing.

## Application fixes in this audit

- Signup now distinguishes an immediately authenticated session from a confirmation-email flow. Immediate sessions go to onboarding instead of incorrectly being told to check email.
- Signup confirmation specifies this application's onboarding return URL. The deployed Supabase redirect allowlist must permit that origin/path; this audit does not change its settings.
- Login and signup reset loading state after exceptions and display a retry message rather than leaving the form stuck.
- Email addresses and signup display names are trimmed; passwords are preserved exactly.

## Account eligibility and launch blockers

| Platform | Supported destination | Remaining public-launch requirement |
| --- | --- | --- |
| Facebook | Pages managed by the signing-in Facebook identity | Required advanced access and successful unrelated-user test. Personal profiles are not managed destinations. |
| Instagram | Business/Creator accounts linked to managed Facebook Pages | Required Meta advanced access and unrelated-user test. Consumer accounts are unsupported by this route. |
| YouTube | Channels the signing-in Google identity may authorize | Google verification for requested scopes, successful independent-user/channel test; analytics API enablement remains separately pending. |

The owner requested retaining all 25 Meta review requests. That draft still needs genuine feature recordings and reviewer access; several retained features have no established implementation. Do not describe it as submitted or approved. Publishing an app alone does not approve its sensitive permissions.

The dedicated SocialVerse login must work independently of the Meta login. A Facebook account cannot substitute for SocialVerse email/password signup. Complete a separate-user acceptance run before declaring this flow ready for any customer:

1. Sign in or register a dedicated SocialVerse user; complete email confirmation and onboarding as required.
2. Create two test brands and verify each survives reload and is absent from a different user's workspace.
3. Connect an eligible Facebook Page and professional Instagram account using an identity without app roles; inspect provider consent and confirm only controlled test assets.
4. Connect a different YouTube channel through Google consent.
5. Reload Accounts and Analytics; verify account IDs, brand association and independent counts. Test denied consent, expired selection, reconnect and missing-asset guidance.

Frontend fixes are local until committed/pushed and the hosted build is published. The earlier Lovable preview/publish gate is not resolved by this local audit.
