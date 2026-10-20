# Analytics report redesign

The Analytics page now starts with a channel comparison table, followed by summary cards, daily audience and reach/impressions charts, publishing activity and a paginated content report. Brand scope applies throughout. Channel filters apply to all sections and CSV export.

## Periods

Today, Yesterday, This week (Monday onward), This month, Last 7/30/90 days and a custom calendar range. All ranges use complete local calendar days, including the final day's evening. The comparison period is the immediately preceding range with the same number of calendar days. A partial current week/month compares the same number of days, not an entire previous week/month.

Snapshots and synced platform posts are fetched in stable 500-row pages, covering the selected period plus the comparison period. No schema or database changes are required.

## Metric definitions

- Audience is each account's last saved observation **inside** the selected period. Missing observations display a dash rather than today's count in a historical report.
- Net follower change is that observation minus the latest available observation in the comparison period; it is not gross new followers. No baseline means unavailable. Percentage change with a zero baseline is unavailable.
- Posts/videos are synced posts published during the selected dates, including posts created directly on the provider.
- Post engagements are the latest synced lifetime likes, comments and shares for those posts. These are not interactions received only during the selected dates. The comparison is between publication cohorts.
- Post reach is the sum of available per-post lifetime reach, with a coverage count. It is not deduplicated unique reach. YouTube views remain separate from reach.
- The daily chart retains the existing sync data semantics: YouTube views are stored in the impressions field, and some platform insights are zero-filled when unsupported. The page discloses these limits. Synced zero engagement counts may also reflect provider limitations. No values are copied from another platform or invented to match the reference image.
- CSV exports the selected brand/channel/date summary and comparisons, with blank fields for missing metrics.

## Validation

39 tests pass, including local-day boundaries, Monday week boundaries, equal prior periods, late-evening posts, account isolation, missing follower history and undefined percentages for zero baselines. TypeScript/build and lint checked; existing lint warnings remain. No social posts or account connections are created by this work.
