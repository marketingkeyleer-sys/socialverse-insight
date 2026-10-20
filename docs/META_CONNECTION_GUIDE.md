# Facebook and Instagram connection guide

The existing Meta OAuth integration supports Facebook Pages and Instagram Business/Creator accounts linked to Facebook Pages. A normal Facebook account is used to authorize managed Pages. This change does not add personal-profile publishing or personal Instagram API access.

## Changes

- Accounts and onboarding now show a guided connection dialog before opening Facebook authorization.
- Facebook users choose between managing a Page and having only a personal profile. The latter route explains creating a Page or getting the required Page access.
- Instagram users choose a Business/Creator account or a personal account. Personal-account setup explains switching to professional and linking a Page before continuing.
- The dialog names the destination brand, explains asset selection, shows connection errors inline and preserves the existing OAuth state/confirmation flow.
- Authorized-account selection now supports searching and displays account IDs to distinguish similarly named assets.
- No new permissions, secrets, provider access grants, database changes or social posts are introduced. The existing per-brand/platform account selection restriction remains.

## Public availability

Credentials being configured does not establish that an app is approved to serve every customer. Live inspection subsequently confirmed that the deployed OAuth flow uses Dhivya app 975939348747280, which is Published and connected to the verified Keyleerkart business portfolio. Its permission review is Not submitted, with allowed-usage evidence incomplete. Customer-wide permission access is not represented as approved. See META_REVIEW_PACKET.md for verified app identities, policy updates and preparation notes. Required access and review decisions are controlled by Meta.

The current Instagram route uses Facebook Login and requires a linked Page. Instagram Login without a Page is a separate integration and has not been added or advertised.

## Sources

Meta's official Instagram workspace: https://www.postman.com/meta/instagram/overview
Facebook Login integration collection: https://www.postman.com/meta/instagram/folder/9cgqucg/instagram-api-with-facebook-login
Meta developer dashboard: https://developers.facebook.com/apps/

## Verification

Production build passed and lint reported no errors (existing warnings and the icon lookup warning remain). The update was published through Lovable and the public bundle verified. The live Facebook Page dialog and Instagram personal-account setup were checked. Starting the Instagram authorization flow confirmed the production Meta client ID; the provider consent step was not approved and no external account was saved as a test.
