# Live backend status — 20 October 2026

This status supersedes the earlier audit's statement that database additions
and backend deployment were pending.

## Database

Project: `igdbgaroizwqaphdhimd` (existing shared Supabase project).

At the user's request, no migration files, migration runner, `db push`, reset,
or seed were executed. Required objects were added using direct transactional
SQL in `scripts/add-required-database-objects.sql`. Migration history was not
modified. Do not replay migrations 019, 020, or 022 over these existing objects.
The direct setup script is a one-time operation; do not rerun it blindly.

Added:

- `sv_oauth_pending` and `sv_inbox_state`, with access controls.
- Nullable `sv_posts.connected_account_ids`.
- Confirmation and ownership validation functions and eight triggers.
- Three missing SocialVerse profiles for existing Auth users.
- Restricted editable profile columns to prevent self-upgrading paid limits.

The transaction checked fingerprints of every pre-existing SocialVerse profile,
connected account, and post. All were preserved. No Auth users were created,
deleted, or changed. No personal token was rotated or replaced. Existing cron
jobs and other applications' tables were left unchanged. Configurable scheduler
setup from migration 021 was not applied; the existing scheduler still targets
this same project.

Counts before: 16 profiles, 10 connected accounts, 1 post.
Counts after: 19 profiles, 10 connected accounts, 1 post.

## Verification

Before committing, the complete additions and confirmation RPC/replay checks
passed in a rolled-back transaction. Test account/token rows were not committed.

After committing, `scripts/verify-live-database-isolation.sql` passed using two
existing user IDs internally and rolling back every attempted write. It verified:

- Both users see only their own connected accounts.
- A user cannot update another user's account.
- Publishing destinations and inbox references reject foreign accounts.
- Users cannot upgrade their own plan.
- Pending encrypted OAuth tokens are not accessible to authenticated clients.

The earlier 13 mocked regression tests, production build and type checks remain
valid; no runtime application code changed during this database/deployment step.
Real provider consent, social publishing and inbox replies remain untested.

## Supabase deployment

Deployed successfully:

`oauth-start`, `oauth-callback`, `oauth-accounts`, `publish-post`,
`run-due-posts`, `sync-account`, `run-due-syncs`, `connection-status`.

The existing Meta Login for Business configuration was preserved as
`META_LOGIN_CONFIG_ID` after verifying that the configured client matches the
previous installation. Existing client secrets and encryption keys were retained.

Live smoke checks: unauthenticated OAuth-start, account-confirmation,
publish and cron requests return 401. A callback missing state returns a safe
302 error redirect. No social posts, messages or broadcasts were sent.

## Frontend deployment pending

The current server-configured return origin is `http://localhost:5173`.
The user has not yet supplied a frontend hosting destination/project.
Once supplied, deploy `dist/`, configure SPA routing and public Supabase
environment values, and update `APP_URL`, allowed origins, and Auth redirect
URLs for that specific host. Do not change the destination by guessing.

Provider app review/permissions, real two-user account consent, and the broader
unfinished product features listed in `AUDIT_AND_DEPLOYMENT.md` still require
follow-up before claiming full production readiness.
