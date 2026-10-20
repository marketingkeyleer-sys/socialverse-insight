# Brand workspace update — 20 October 2026

A brand represents a company or client. The shared workspace selector defaults
to the first existing brand, offers Unassigned accounts for legacy data, and
provides an explicitly selected All brands portfolio view. Selection is scoped
to the signed-in user and is reset if that user changes. It is not a new team
role or a permission boundary between employees of the same user account.

The selected company's account IDs scope dashboard metrics, account cards,
analytics, exports, platform posts, best posts, activity charts, composed post
lists/details, scheduled posts, calendar, ad accounts and campaigns, inbox
account choices and WhatsApp account choices. Query cache keys include the
workspace and account IDs. Page state remounts on workspace changes so an old
conversation, selection or post preview does not remain in the new company.
Profile/settings and the explicitly labelled account activity feed remain
account-wide. Accounts can still be deliberately moved between companies by
their owner from Accounts.

Follower counts come from each channel's saved provider data. Portfolio
platform cards now include every account rather than silently choosing the
last account on that platform. The distribution chart sums per-platform
accounts with one legend entry per platform. Summed followers/subscribers are
labelled as combined platform audiences, not unique people. Google, Meta and
LinkedIn approvals and token health still determine what can actually sync.

## Posts and publishing

Direct transactional SQL in `scripts/add-brand-post-fields.sql` added
`sv_posts.brand_id`, `sv_posts.platform_content`, an index and a brand-reference
trigger. It fingerprinted existing post data before/after and preserved it.
No migration runner, reset, seed or historical data rewrite was used. Older
posts with explicit account destinations remain visible under those accounts'
current brands; unassigned legacy drafts stay in Unassigned / portfolio.

New composer content is written independently per platform, including caption,
optional YouTube title and selected media. The optional working draft is only
copied when the user chooses Copy working draft for a specific platform. A
single brand is required before saving. Empty drafts can be saved without
publishing. Quick scheduling targets a single platform; the full composer is
used for tailored multi-platform content. Post duplication preserves the brand
and variants; post details show each platform's saved version.

Both manual and scheduled publishers resolve each platform's content before
calling its provider and reject destinations outside an explicitly assigned
post brand. Character/media checks run before the publishing claim. Legacy
posts without variants retain their original content. Existing retry/atomic
claim and tenant isolation checks remain in place. `publish-post` and
`run-due-posts` were deployed to the existing Supabase project.

## Visual changes

Manrope typography, a teal/slate interface, individually coloured analytical
series, clear platform glyphs and short integration captions replace the older
homepage treatment. Four glyphs use Simple Icons' brand-source vectors; the
existing standalone LinkedIn mark is retained. Platform links go to the
platforms' public websites, not invented SocialVerse company profiles.
Placeholder testimonials and an unsupported team feature claim were removed.

## Validation and limits

- 34 automated tests passed, including two-company follower totals, empty
  company filtering, cross-company publisher rejection, legacy compatibility,
  and actual Facebook/LinkedIn request bodies with different captions.
- `scripts/check-brand-workspaces.sql` passed live. It checked brand and
  variant persistence, independent audience totals, same-owner company
  boundaries and cross-user references. Every test row was rolled back.
- The production build passed. Existing lint warnings remain; no lint errors.
- The live API returned HTTP 200 for the new fields, empty account scopes,
  per-company post filters and unassigned legacy post filters.
- A read-only browser attempt found that Supabase Google website sign-in is
  disabled (`Unsupported provider: provider is not enabled`). Login and signup
  now query public Auth settings and show that button only when it is enabled.
  Email authentication remains available. This does not disable or change
  the separate YouTube channel OAuth flow.
- A separate attempt to create a production QA login was rejected by automatic
  approval review. It was not retried or bypassed; no persistent QA login was
  created. Browser verification uses public pages and existing-account reads.
- No social content was sent. Real provider consent/publishing cannot be
  claimed verified from mocked payload tests. Google verification remains
  pending independently of this application update.
- npm reported 17 production-classified dependency advisories (4 moderate,
  12 high, 1 critical) in the existing tree, including CLI/server transitive
  dependencies. This update does not certify the whole dependency tree as
  production-ready or force dependency downgrades to silence an audit.

No existing user's brand, account, post or credential was deleted or rewritten.
