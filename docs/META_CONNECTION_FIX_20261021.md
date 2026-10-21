# Facebook and Instagram connection fix — 21 October 2026

## Change deployed

Production app: Dhivya, 975939348747280. The old SocialVerse Login configuration (1030784340001736) requires ten permissions, including advertising, business management and messaging. Basic account connection now has separate configurations:

| Route | Configuration | Explicit selected permissions |
| --- | --- | --- |
| Facebook Page | SocialVerse Facebook Connect — 1150403161000124 | pages_show_list, pages_read_engagement |
| Instagram via Facebook Login | SocialVerse Instagram Connect — 2165851084004173 | instagram_basic, pages_show_list, pages_read_engagement |

Both use General login with a User access token, allowing a normal Facebook identity to authorize managed assets. public_profile remains in the application's OAuth request; Meta automatically grants that base permission and does not expose it in the configuration selector.

Supabase secrets FACEBOOK_LOGIN_CONFIG_ID and INSTAGRAM_LOGIN_CONFIG_ID now identify these saved configurations. META_LOGIN_CONFIG_ID remains unchanged as a compatibility fallback. oauth-start selects the dedicated configuration for basic connection. If an existing account in the same brand has broader scope grants, it retains the legacy feature-capable route during reconnection. An explicit user/brand/platform lookup prevents another user's feature scopes from changing this selection. Existing connected account records and encrypted credentials were not modified by the deployment.

oauth-callback now translates Meta denials and configuration failures into actionable instructions. It distinguishes cancellation/declined access, temporary platform failure and administrator configuration issues. It explicitly explains that a provider app-review restriction cannot be fixed just by retrying or changing the user's account.

## Live verification

The two functions were deployed to existing Supabase project igdbgaroizwqaphdhimd. No migrations or schema changes were run.

- Facebook: started from the existing empty Mani brand workspace. The real Facebook OAuth URL used config 1150403161000124 and app 975939348747280 with only the existing three basic request scopes. Continuing the previously granted authorization returned to SocialVerse's account-selection dialog with RobotVerse and Keyleerkart Pages, with no callback error.
- Instagram: the real OAuth URL used config 2165851084004173 and the four basic Instagram request scopes. Continuing the existing authorization returned robot.verse and keyleerkart in the selection dialog, with no callback error.
- Both temporary selection requests were cancelled. No account was moved, replaced or attached to a brand. Robotverse was restored as the active workspace. No social post, ad or message was sent.
- These checks used the existing signed-in app user. They do not prove that unrelated customers have advanced access.

## Remaining external-user restriction

Meta's Page use-case screen still marks pages_show_list and pages_read_engagement as Ready for testing. The configuration wizard explicitly states that standard-access permissions are requested only from people with app roles. Published mode is not approval for public-customer permission access. The existing broad review draft remains as requested by the owner; it still needs genuine feature recordings and accurate review evidence. No review was submitted or policy agreement accepted by this fix.

Supported eligibility:

- A personal Facebook identity may sign in to authorize Pages it manages. Personal-profile publishing is not implemented or advertised.
- Facebook Page managers may select authorized Pages.
- This Instagram integration requires Business/Creator accounts linked to managed Facebook Pages. Personal Instagram consumer accounts require professional-account setup first. Direct Instagram Login without a linked Page is a separate integration, not provided by this change.

The earlier frontend release from commit 66a96061 remains subject to its recorded Lovable publishing gate. Today's backend changes work with the currently published account-selection interface and do not depend on a new frontend release.

## Validation

The full 45-test suite passed, followed by targeted provider/security reruns after reconnect-preservation logic was added. The actual OAuth-start test verifies new basic connections, preservation of a brand's existing feature grants and isolation from another user's grants. Edge Function TypeScript check passed. Real Facebook and Instagram authorization/callback/discovery checks passed as described above.
