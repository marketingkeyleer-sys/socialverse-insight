# SocialVerse product update — 22 October 2026

## Changes

- Added a signed-in Home page at `/home`; the public introduction remains at `/welcome`.
- Compose lists each connected channel separately, with platform controls, All and Clear all. One destination is supported. Content remains editable per platform.
- Calendar uses local dates, refreshes after post changes and queries the visible month rather than the first 500 historical posts. Platform filters and empty/error states clarify what is shown.
- Scheduled times must be in the future. A database trigger atomically enforces active scheduled-post capacity, including concurrent requests; editing a scheduled post retains its slot.
- Media uploads run three at a time, show progress and retain successful files after partial failure. Saving waits for uploads to finish.
- Caption-only AI is the default. Optional image generation runs alongside captions; image failure preserves a usable caption. Authenticated hourly usage is shown and enforced server-side (20 requests/hour unless configured otherwise).
- LinkedIn Pages appear in analytics with an observation date for current followers. Historical growth remains unavailable without snapshots. Provider monitoring covers recent posts, not complete historical analytics.
- Posts has distinct status filters, explicit active-tab styling, counts, explanations and pagination. Provider receipts remain Publishing until confirmed.
- Upload-Post publishing targets the verified brand Page, uses owned media and idempotency keys, and reconciles exact request/external IDs. Ambiguous outcomes block automatic retries.
- Connected channels appear first in Accounts. The duplicated sidebar profile avatar was removed; the header profile/settings menu remains. Privacy and Terms have Back navigation.
- Personal publishing remains a manual copy/download/calendar-reminder workflow and does not consume automated scheduling slots.

## Validation and deployment

- Production build passed (`tsc -b && vite build`). Bundle-size warning remains.
- 63 automated tests passed, covering ownership, OAuth, publishing, local dates, AI authentication/quota handling and image-service partial failure.
- Lint completed without errors; existing warnings remain.
- Reversible production-database transaction verified scheduled-post capacity, scheduled-post editing and AI quota exhaustion; all QA writes rolled back.
- AI quota table/function and scheduling trigger were deployed additively. No migration runner, reset or existing-data deletion was used.
- `generate-post`, `publish-post` and `run-due-posts` Edge Functions were deployed.
- Publishing and account sync cron jobs are active every five minutes. Scheduled delivery can therefore start after the selected minute, with additional provider processing time.

## Remaining external requirements / limits

- Both existing Instagram connections lack content-publishing scopes. Approved Meta publishing access and reconnection are required. UI checks explain this before scheduling.
- API automation for personal Facebook profiles and personal Instagram accounts is not provided by their official publishing APIs. Use the manual workflow or an eligible Page/professional account.
- WhatsApp server linking is not configured in the current deployment.
- Upload-Post's provider quota is separate from SocialVerse's plan limits; provider rejection is shown to the user.
- Real social publication was not used as a QA test: no public test content was posted. Provider publishing behavior was tested with mocks; final live delivery requires reviewed content and eligible connections.
- There were no existing scheduled posts in the inspected owner account. The empty calendar was consistent with its data as well as the refresh/date defects addressed here.
- Google/Meta/LinkedIn review decisions cannot be bypassed by application changes.
- The public frontend update was published and checked in the browser (Home, channel selection, calendar, post filters, LinkedIn analytics and Privacy Back navigation).
- Live caption generation returned OpenAI HTTP 429 (provider quota or rate limit). Authenticated usage tracking works and the public UI keeps this actionable error visible. The administrator must check OpenAI billing/limits; no billing or purchase changes were made.
