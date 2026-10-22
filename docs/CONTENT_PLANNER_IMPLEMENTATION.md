# Content planner and LinkedIn chart follow-up

## Implementation

- `/content-planner`: a one-month or one-year calendar for a single company brand, with timezone, weekdays, posting time, destination selection, a company brief, optional images, per-plan daily generation budget and total request estimates.
- Plans start paused. Activation requires explicit consent to AI charges and the chosen review-first or automatic publishing mode. Review-first is the default.
- The background worker generates one destination-specific caption/hashtag set and optional image per run, for slots within the next 14 days. It uses the existing hourly AI reservation function and owned storage paths.
- Review-first creates drafts; approval schedules the edited draft. Automatic mode creates scheduled posts, consumed by the existing publisher. Scheduling capacity remains enforced by the existing database trigger.
- Future ungenerated slots remain in the planner, not the Calendar. Actual scheduled posts appear in Calendar. Failed/missed slots are held for attention; there is no late surprise publication.
- Pausing or ending a plan stops new generation. Already scheduled posts remain queued and must be changed in Posts. Generated images and captions are retained for a retry if queuing fails.
- Duplicate create requests reuse their request key. Worker leases and a unique campaign-item/post relationship prevent duplicate saved posts. Interrupted work requires review before retry. A provider failure pauses the plan.
- Plans, accounts, slots and posts are checked against their owner and company brand. Browser clients have owner-scoped SELECT access only to planner tables; management uses authenticated Edge Functions and service-only RPCs.
- LinkedIn sync now records real daily follower observations. `available_metrics` distinguishes follower-only observations from unavailable daily reach/impressions/engagement. A first point is displayed as a dot, with gaps retained. A separate graph shows latest lifetime likes/comments/shares grouped by post publication day.
- Personal Publishing was removed from navigation and new-draft links. Its old route redirects to Compose unless opening an existing saved manual draft; saved content remains accessible through Posts.

## Limits and external requirements

- The AI does not perform live trend research or guarantee viral results. The brief can include verified timely topics. Prompts prohibit invented discounts, claims, testimonials and current-trend assertions.
- Automatic image/caption plans support Facebook Pages, professional Instagram and LinkedIn. YouTube requires real video content, and WhatsApp requires explicit recipients; use Compose for those destinations.
- Maximum 10 unfinished plans/user, 2,500 posts/plan, 50 destinations/plan and 1–20 new captions per day/plan. The shared worker currently handles one slot per five-minute tick, so generation is gradual rather than instantaneous. Larger deployments need additional worker capacity; lease claims support concurrent workers.
- AI provider quota/billing is a separate requirement. The current live OpenAI provider previously returned HTTP 429. No quota, purchase or billing changes were made.
- Instagram publishing still requires approved permissions and reconnection.

## Validation and deployment state

- LinkedIn observation SQL was applied additively, seeding only real last-sync follower observations. No historical follower values were fabricated.
- The LinkedIn graph build and 67 tests passed before the additional planner work.
- Frontend and new Edge Function TypeScript checks pass for the planner. The 77-test regression suite passed, followed by all five API tests after adding a further post-status isolation case (78 total regression cases). Coverage includes month/year slots, DST/leap dates, brand isolation, permission failures, quotas, explicit activation consent and retained-content retries. A flaky legacy test was corrected to compare concurrent publishing outcomes independently of their completion order.
- The full production build now passes with approved execution permissions; the earlier sandbox `spawn EPERM` is resolved. The existing bundle-size warning remains.
- Approval review is available again. Planner tables, policies, functions and the protected management/worker endpoints are deployed. LinkedIn sync/publishing bundles are updated.
- The reversible production-database transaction passed queue claims, daily reservation limits, idempotent creation, review-first drafts, pause/resume, automatic scheduling, duplicate-completion prevention and foreign-user RLS checks. Every transaction test write was rolled back. No paid campaign or public social post was activated for testing.
- The overlapping-worker test also passed: a second connection skipped the locked plan. Its temporary QA plan was removed and the remaining QA-plan count was zero. The protected worker is scheduled every five minutes; real plans remain paused until the user explicitly activates them.
- The protected idle worker probe returned HTTP 200 with `processed: 0` and no error. No provider calls or social posts were made by the probe.
- The frontend was pushed to GitHub main and published through Lovable. Browser checks confirmed the live Content planner navigation, month/year preview, All selection, company-switch form reset and successful owner-scoped plan loading. A year preview produced 157 posting dates × two eligible destinations = 314 planned posts, without saving or activating a plan.
- Both brands' LinkedIn follower points were verified on the public Analytics page. Unavailable daily reach displays an explicit explanation instead of a fabricated zero series. New daily observations will build a trend over time; historical observations were not invented.

## Deployment and repeatable verification sequence

Use the existing authenticated Supabase CLI; do not retrieve administrative API keys or run the migration runner.

1. Run `npm run build`, the regression suite and Edge Function type checks.
2. Apply `scripts/add-content-campaigns.sql` with `supabase db query --linked --file ...`.
3. Run `scripts/verify-content-campaigns.sql`; every test write rolls back. `scripts/verify-campaign-concurrency.ps1` checks overlapping workers before any real plan is active, then removes only its temporary QA plan. No AI provider or social publishing call is made.
4. Deploy `content-campaigns` and `run-content-campaigns` using the existing function configuration.
5. Deploy the updated `sync-account`, `run-due-syncs`, `publish-post` and `run-due-posts` bundles, because they include LinkedIn sync code.
6. Apply `scripts/enable-content-campaign-cron.sql`. It reuses the existing authenticated cron command inside the database without exposing its secret. Verify only job name/schedule/active state.
   Optional `scripts/verify-campaign-worker-idle.sql` probes the worker only when no plans are active. Read its returned request ID from `net._http_response`, selecting only status and sanitized outcome fields.
7. Commit the relevant files, push the authorized main branch and publish through Lovable. Verify both brands' LinkedIn graphs and planner controls in the browser.
8. After the AI quota issue is resolved, test a review-first plan in an isolated brand, inspect its draft and then test an explicitly approved live post. No automatic campaign should be activated on the user's behalf without reviewing its concrete company brief, destinations and expected usage.

The queue uses PostgreSQL's documented `FOR UPDATE ... SKIP LOCKED` pattern, with a separate plan lock and daily-reservation check: https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE
