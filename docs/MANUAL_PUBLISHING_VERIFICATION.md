# Personal-account workflow verification

Implemented route: `/manual-publish`. Manual publishing uses existing brand-scoped draft storage with no schema change. It does not connect personal accounts through an unsupported Meta API, and does not claim automatic publishing or personal analytics.

## Checks completed

- Full 52-test suite passed, including manual payload isolation, actual publisher rejection before any provider call/status claim, calendar UTC conversion, reminder links, alarm generation, invalid date rejection and calendar-line injection/length checks.
- Production TypeScript/Vite build passed and lint had no errors (existing warnings remain).
- Started the built frontend on loopback port 5173 and signed in through the normal SocialVerse owner login. The new page loaded with brand selection, platform choice, caption/media actions and reminder instructions.
- Selected Instagram; the outbound destination changed to the official Instagram site.
- Saved one clearly labeled `[QA] Manual publishing verification` draft in the existing Robotverse brand. Reload restored its platform, title and caption from the application database. No media was uploaded, scheduled job created, provider account changed, or social post sent. This QA draft remains available for inspection.
- Added a guard so an existing draft's content is hidden while the selected brand's scoped query is loading or cannot return that draft. This prevents the previous form values appearing under another workspace while awaiting a query result.

## Limits of verification

No independent customer authorization test, real media download or calendar import was completed in this run. The reminder file is generated for the user's calendar; SocialVerse does not deliver a server notification. Browser automation and Lovable reload later timed out, preventing further visual checks or hosted publication confirmation. GitHub push and local build success alone do not establish a live release.

The Meta review, Google verification, dedicated reviewer access and 25-request evidence limitations remain listed in PUBLIC_CONNECTION_RELEASE_PLAN.md. This feature is a usable manual route for personal-account users, not approval or a replacement for the official connection flows.
