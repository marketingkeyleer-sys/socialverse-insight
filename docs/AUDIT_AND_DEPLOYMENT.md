# SocialVerse audit and implementation handoff

Audit date: 20 October 2026. Work was performed in the existing checkout.
The checkout already contained extensive uncommitted brand and WhatsApp work;
those changes were preserved. No database was reset, no production deployment
was performed, and no real social posts or messages were sent.

## Architecture and verified local findings

The application is a React 19 / TypeScript 6 SPA built with Vite 8, Tailwind 4,
Radix/shadcn components, React Router 7, TanStack Query, and Recharts. Supabase
provides Auth, Postgres, Storage, and Deno Edge Functions. Background publishing
and sync use pg_cron, pg_net, and Vault. There is an existing optional Node
WhatsApp QR bridge alongside the official Cloud API integration.

Auth identity is the tenant boundary. Brands are account groups owned by one
user; they are not shared team workspaces. Most interactive backend functions
use the caller's JWT and database RLS. Workers use service-role access and must
therefore filter ownership explicitly. Tokens are encrypted with AES-GCM using
an installation-level server secret.

### Account-connection failures: what is established

* `providers.ts` hardcoded one installation's Meta Login for Business config ID.
  It was always included even when the configured Meta client belonged to a
  different app. It also requested sensitive messaging, ads, and publishing
  scopes together during basic Facebook connection. Removed the embedded
  configuration ID, made it server-configurable, and made scopes configurable
  with minimal connection defaults. This corrects concrete configuration
  coupling; a particular external user's consent failure still needs its
  provider error and developer-console access to diagnose conclusively.
* The signup trigger creates a SocialVerse profile only for new `auth.users`.
  In this shared Auth project, previously registered users can have no profile.
  Their connected-account insert fails its profile foreign key. Migration 019
  backfills missing profiles without overwriting existing profiles. Whether
  affected real users have this condition has not been checked remotely.
* A brand connection discarded all identities except `rows.slice(0, 1)`.
  The callback now discovers assets, stores encrypted temporary candidates,
  and lets the authenticated initiating user choose the exact account(s).
  The existing one-account-per-platform-per-brand rule remains: choose one
  for a brand, or select multiple through the ungrouped Add account buttons.
* The code already stored the initiating user's ID in one-time OAuth state.
  There was no evidence of an OAuth callback globally assigning every user
  to the developer's personal account. App approval/access restrictions cannot
  be fixed by replacing that already user-specific state mechanism.

Meta permissions/access level, configuration ownership, public availability,
business verification, Google test-user restrictions, and LinkedIn products
must be inspected in their consoles. None of those remote settings were
accessible or verified during this local work. Meta's official documentation
requests returned HTTP 429 during this session; do not treat the audit as a
successful live verification of all current Meta requirements.

### Critical isolation and publishing findings fixed

* The scheduled publisher selected all active accounts matching platform names
  using service-role access, without `user_id`. It could use another tenant's
  account. Account selection now filters owner in the database and validates
  both the post owner and every destination in shared policy code.
* Posts previously stored only platform names. The composer and calendar now
  persist explicit destination account IDs and can select multiple accounts
  on the same platform. Legacy posts are accepted only when each platform has
  exactly one eligible account; ambiguous posts require editing.
* Workers previously read a batch and unconditionally marked every ID as
  publishing. A competing worker could claim the same batch. Manual and cron
  publishing now share an atomic compare-and-set claim.
* Successful per-account results are saved before the next destination runs.
  Retries skip previously successful destinations. Network uncertainty is
  recorded and blocks an automatic resend. This is not an exactly-once
  guarantee across external HTTP side effects and database writes.
* Return URLs were trusted from browser input, and brand IDs were accepted by
  a service-role OAuth state insert without ownership validation. Return URLs
  now use configured origins; brand ownership is checked before redirecting.
* RLS on a child row did not establish ownership of its parent foreign keys.
  New database triggers reject foreign brands, post results, account analytics,
  imported posts, inbox state, and explicit publishing destinations.
* Authenticated users could update their own paid plan and account limits.
  Profile writes are now restricted to name, avatar, timezone, and onboarding.
* Query caches are cleared when the signed-in identity changes, and stale
  asynchronous profile loads are prevented from replacing another user's
  profile during an auth change.
* Password recovery now has a dedicated reset route and form. The settings
  form previously displayed a current-password field but never verified it;
  it now verifies that password before submitting a password change.

## Implemented behavior and existing capability

| Area | Current behavior | Limits requiring follow-up |
| --- | --- | --- |
| Connection | Per-user OAuth, state replay prevention, allowed return origins, asset confirmation, encrypted candidates, account limits, ownership checks, cancel/expiry | Live grant and app-review validation needed |
| Reconnection | Updates same owner/platform/identity; preserves Google refresh token if absent in new grant | Disconnect removes local authorization; remote provider revocation remains manual |
| Facebook | Existing text/photo/carousel publishing retained; video now uses video endpoint | Verify permissions, video processing, actual media limits with approved app |
| Instagram | Existing image/Reel/carousel flow retained; carousel video type fixed | Linked professional account required for this Facebook Login integration; verify media processing and review |
| YouTube | Existing video upload/analytics retained; encrypted refresh-token rotation and save failures handled | Real upload test, quotas, OAuth verification; restrict uploads to owner's hosted video |
| LinkedIn | Added text publishing for member and organization using versioned Posts API | Required product grants; image/video upload and analytics still incomplete |
| Scheduling | Explicit destinations, atomic shared claims, owner filtering, future-time validation, configurable worker URLs | Five-minute cadence; monitor failed/stuck work and Edge Function execution limits |
| Inbox | Existing Meta DM retrieval/reply; search, unread filter, persistent local read state and private notes; reply errors visible | Comments/reactions, durable webhook ingestion, complete pagination and team assignment not implemented |
| Analytics | Existing real sync and charts/CSV retained; per-account follower totals fixed when sync dates differ; account ID included in CSV | Some unavailable metrics still represented as zero; multi-account chart/trend audit, large-range pagination, LinkedIn analytics remain |
| Teams | Strict individual ownership; brands remain per-user | Invitations, memberships, roles and shared workspaces are not implemented |

Read status is a SocialVerse-local override, not a claim that the provider's
native inbox read state changed. Search currently covers fetched conversations.
Notes are private to the owner; there is no implicit team access.

## Database changes

Apply existing migrations 001–018 first if not already present, then:

* **019**: backfill missing profiles; service-only encrypted pending OAuth table;
  transactional confirmation RPC with owner lock, expiry/replay and selection
  checks, account limits, refresh preservation; parent-owner triggers; restrict
  profile update privileges.
* **020**: nullable explicit destination UUID array on posts and ownership check.
* **021**: Vault-configured worker dispatch function and named cron schedules;
  removes the need to edit historical project-specific worker URLs; temporary
  OAuth cleanup every ten minutes. Existing named schedules are updated.
* **022**: RLS-protected per-account conversation read status and private notes.

These migrations were written but NOT applied or executed here. Run the SQL
test in a disposable database before deploying. Existing foreign-owner corrupt
references, if any, require inspection; new triggers do not retroactively repair
all historical rows. Existing plaintext-era values cannot be converted into
valid encrypted tokens; reconnect affected accounts.

## Local setup and validation

Use the installed Node version supported by the pinned Vite dependency. This
checkout was checked with Node 22.17.1; the build completed successfully.

```powershell
npm ci
Copy-Item .env.example .env.local
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.
npm run dev
```

Only public Supabase URL/anon key belong in VITE variables. The anon key is not
an authorization boundary: RLS must be enabled. Use a separate staging Supabase
project or a local Supabase stack with Docker; do not reset the shared database.

```powershell
npm test
npx tsc -p tsconfig.edge.json
npm run lint
npm run build
```

The Edge type check uses local offline Deno declarations and the installed
Supabase types. It is not a substitute for `deno check` and running Edge
Functions in the real Supabase runtime. The Node test loader mocks the Supabase
module import and runs actual shared policies/handlers with in-memory database
doubles and mocked external HTTP calls. No credentials are used.

SQL integration checks (not executed here):

```powershell
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/tenant_isolation.sql
```

The SQL test creates two disposable auth fixtures inside a rolled-back
transaction, verifies real RLS and parent ownership, forbids self-upgrading,
and exercises actual OAuth confirmation/refresh preservation/replay rejection.
Run only against a disposable or staging project: this project shares Auth
with another application and signup triggers in that app may also execute.

## Server secrets and provider configuration

Use `supabase/.env.example` as a server-only reference. Copy values to a
gitignored secrets file or the Supabase Secrets UI. Never commit filled secrets.
Keep the existing encryption key for existing tokens; changing it without a
rotation migration makes previously encrypted tokens unreadable.

Required common values: `APP_URL`, `OAUTH_ENCRYPTION_KEY`, and the relevant
provider client ID/secret. `OAUTH_ALLOWED_ORIGINS` is a comma-separated list
of additional frontend origins, including local development when desired.
The Supabase runtime provides URL, anon key, and service-role key automatically.

Register exact callback URIs:

```
https://<project-ref>.supabase.co/functions/v1/oauth-callback/facebook
https://<project-ref>.supabase.co/functions/v1/oauth-callback/instagram
https://<project-ref>.supabase.co/functions/v1/oauth-callback/youtube
https://<project-ref>.supabase.co/functions/v1/oauth-callback/linkedin
https://<project-ref>.supabase.co/functions/v1/oauth-callback/linkedin_page
```

* **Meta:** set `META_CLIENT_ID`, `META_CLIENT_SECRET`, and, when using Login
  for Business, `META_LOGIN_CONFIG_ID` from THAT app. Verify its asset selection
  and granted permissions in the console. Defaults request connection scopes.
  Enable approved capabilities through `FACEBOOK_OAUTH_SCOPES` and
  `INSTAGRAM_OAUTH_SCOPES`. Publishing needs `pages_manage_posts` or
  `instagram_content_publish`; insights/messaging require the matching approved
  read/insight/message scopes. Add ads scopes only if offering ads management.
  Do not request unapproved ads permissions just to connect a Page. Confirm
  external-user access and any App Review/business verification requirements.
  Reconnect existing accounts after permission changes. Meta connection now
  exchanges the short-lived user token for a long-lived token; expired or
  revoked grants still require reauthorization. This implementation uses
  Graph v21.0 and needs endpoint/version compatibility verification before launch.
* **Google:** set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`; enable YouTube Data
  API v3 and YouTube Analytics API. Configure consent audience/test users and
  production verification for the scopes in use. Offline access obtains the
  refresh grant; rotation is stored encrypted. Follow [Google's server-side
  OAuth guide](https://developers.google.com/youtube/data/guides/auth/server-side-web-apps).
* **LinkedIn:** set member credentials, enable the appropriate Sign In/Share
  products, and set `LINKEDIN_OAUTH_SCOPES=openid profile email w_member_social`
  when publishing is approved. Organization credentials use
  `LINKEDIN_ORG_CLIENT_ID`/`LINKEDIN_ORG_CLIENT_SECRET` and approved Community
  Management scopes. `LINKEDIN_API_VERSION` defaults to `202609`; validate it
  against your approved API access and update before sunset. Text publishing
  follows the [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)
  with `w_member_social` or `w_organization_social`. OIDC-only login does not
  grant posting access. Version lifecycle: [official versioning guide](https://learn.microsoft.com/en-us/linkedin/marketing/versioning).
* **Supabase Auth:** set Site URL and allow frontend login/recovery redirect
  URLs. Social account OAuth callbacks above differ from Supabase's Google
  sign-in callback. Verify email delivery and rate limits. Password recovery
  redirects to `<frontend-origin>/reset-password`; allow that route in Auth
  settings. The form updates the authenticated recovery session and signs out
  afterward. Verify the actual email/recovery flow and configure secure password
  change/reauthentication requirements in Supabase as appropriate.
* **WhatsApp:** existing Cloud API and bridge configuration remains. The QR
  bridge is not an official Meta social API integration and must not be
  represented as production-approved official Cloud API support. Prefer the
  official Cloud API for a supported production offering and review the bridge
  separately. No live delivery or webhook verification was performed.

## Scheduler and production deployment

1. Back up and test the linked database. Apply migrations with the Supabase
   CLI only after reviewing the pending migration list:
   `npx supabase db push --dry-run`, then `npx supabase db push`.
   Historical filenames are retained; existing hosted migration history may
   need reconciliation if it differs from this repository. Do not reset it.
2. Set Edge secrets through the dashboard or `npx supabase secrets set
   --env-file <gitignored-secret-file>`. Deploy functions with
   `npx supabase functions deploy`. Preserve public callback/cron/webhook
   `verify_jwt=false` and their explicit state/secret/signature checks.
   `oauth-accounts` is authenticated and must be deployed with the OAuth pair.
3. In the SQL Editor, set Vault `sv_project_url` to your Supabase project base
   URL and `sv_cron_secret` to the same random value as Edge `CRON_SECRET`.
   Use `vault.create_secret` for missing entries or `vault.update_secret` for
   existing entries. Avoid duplicate names. Missing Vault configuration causes
   the worker dispatcher to skip HTTP requests. Verify `cron.job`,
   `cron.job_run_details`, and `net._http_response` after a due test post.
4. Set frontend VITE configuration, run `npm run build`, and deploy `dist/`
   to your static host. Configure all SPA routes to return `index.html`.
   Use HTTPS and allow the frontend origin in OAuth return settings.
5. Before public launch, run real two-user acceptance tests below and address
   the unresolved production work. Build success alone is not release approval.

## Test evidence and acceptance checks

Offline regression suite: **13 passed** at the point this document was written.
Tests cover redirect safety, true-grant scope metadata, follower totals, asset
selection, two-user state ownership, foreign brand denial, callback replay,
token encryption, confirmation privacy, service-role publisher isolation,
parallel claims, successful retry skipping, same-platform multiple destinations,
unknown-outcome blocking, token rotation, and LinkedIn author/permission handling.

Final verification: all 13 regression tests, frontend and backend type checks,
and the production build passed. Lint passed with 13 warnings (no errors),
and the production bundle has Vite's large-chunk warning. The first sandboxed
test/build attempts failed with spawn
EPERM; permitted reruns succeeded. Lint exits successfully with existing
warnings. Database tests, Deno runtime checks, browser acceptance, real OAuth,
real publishing/scheduling, Meta inbox replies, and remote analytics are NOT
verified by these mocks.

For staging acceptance, use two browser profiles and independently authorized
provider accounts. For each user: sign in, create a brand, complete OAuth,
select an asset, refresh the page, and verify the other user sees none of it.
Try guessed foreign IDs against account, post, brand, inbox and confirmation
endpoints; expect rejection. Publish disposable text/media to selected accounts,
schedule and wait for cron, test partial failure/retry and reconnect/expiry.
Confirm notes/read state and analytics/CSV remain isolated after switching users.

## Remaining production blockers

* Real provider grants, app approvals and external-user consent diagnosis;
  local migrations and SQL isolation tests must run against a real database.
* Shared team workspaces, invitations, RBAC, assignments and approval workflow.
* Inbox comments/reactions, full pagination, incoming webhook persistence,
  deduplication and complete delivery status processing.
* LinkedIn media upload/analytics and complete platform content validation.
* Reliable large-video/background processing within Edge Function duration and
  quota limits; durable worker queues, rate-limit backoff, alerting and monitoring.
* Stuck `publishing` or unknown outcomes require operator reconciliation. Check
  the provider first, preserve successful remote IDs, and only then adjust the
  local result/status. Do not blindly reset such posts to scheduled/failed.
* API/provider revocation on local disconnect and full token lifecycle for
  providers without refresh grants; remote app deauthorization/data deletion.
* Storage buckets remain public as originally designed for social media URL
  ingestion. Draft uploads are accessible to anyone with their URLs. Private
  draft storage plus time-limited provider access is required for private media.
* The original self-delete function deletes shared `auth.users`, affecting the
  other application. Replace with app-scoped deletion or separate Auth projects
  before offering independent account deletion in a shared production system.
* Live password recovery/email verification, server-side paid limits on all
  write paths, AI/ads usage controls, credential rotation, dependency review,
  analytics unavailable-vs-zero semantics and high-volume pagination.

This is a substantial corrective implementation, not a claim that the entire
Buffer/Zoho-sized product is production-ready. The blockers above need real
runtime/account access and additional implementation before release.

## Files changed in this task

Modified existing files: `package.json`, `README.md`,
`src/App.tsx`, `src/components/settings/PasswordForm.tsx`,
`src/contexts/AuthContext.tsx`, `src/components/layout/ProtectedRoute.tsx`,
`src/components/calendar/QuickScheduleDialog.tsx`,
`src/components/composer/PlatformSelector.tsx`, `src/hooks/usePosts.ts`,
`src/hooks/useInbox.ts`, `src/hooks/useAnalytics.ts`, `src/types/database.ts`,
`src/pages/Accounts.tsx`, `src/pages/Compose.tsx`, `src/pages/Inbox.tsx`,
`src/pages/Analytics.tsx`, `src/pages/PostDetail.tsx`, `supabase/config.toml`,
`supabase/functions/oauth-start/index.ts`,
`supabase/functions/oauth-callback/index.ts`,
`supabase/functions/_shared/providers.ts`, `.../_shared/publish.ts`,
`.../_shared/sync.ts`, `.../_shared/crypto.ts`,
`supabase/functions/run-due-posts/index.ts`,
`supabase/functions/run-due-syncs/index.ts`.

Added: this document, `supabase/.env.example`, `tsconfig.edge.json`,
`src/pages/ResetPassword.tsx`,
`src/lib/analyticsTotals.ts`,
`src/components/accounts/OAuthAccountPicker.tsx`,
`src/components/accounts/InboxThreadTools.tsx`,
`supabase/functions/oauth-accounts/index.ts`,
`supabase/functions/_shared/oauth-policy.ts`,
`supabase/functions/_shared/publish-policy.ts`,
`supabase/functions/_shared/linkedin.ts`, migrations 019–022,
`supabase/tests/tenant_isolation.sql`, and `tests/` loader/declarations/regressions.
Other pre-existing uncommitted changes are not attributed to this task.
