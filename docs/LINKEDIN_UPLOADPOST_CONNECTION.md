# LinkedIn Page connections through Upload-Post

The existing authorized provider profile can be attached to a SocialVerse brand using server-only configuration. This release supports connection, account confirmation and recent Page post monitoring. Provider publishing and full historical analytics are not implemented.

Set `UPLOAD_POST_API_KEY` as an Edge Function secret. Set `UPLOAD_POST_LINKEDIN_BINDINGS` to a JSON array of `{userId, brandId, profile, pageId}` records. Use the owner's immutable Supabase UUID, the owned brand UUID, the provider profile username, and an organization URN such as `urn:li:organization:123`. Never accept these bindings from client requests. Other brands retain the existing native LinkedIn flow.

`oauth-start` authenticates the owner, checks the brand, retrieves only its configured provider profile, checks reauthorization status, and verifies that the pinned Page matches the configured destination. It creates a pending connection using existing storage. `oauth-accounts` repeats the provider checks before the existing atomic confirmation RPC saves the selected Page. No schema changes or migration execution are required.

The saved encrypted reference identifies the provider profile, member, owner, brand and Page; it does not contain the global API key. The scope marker `socialverse:upload-post` prevents the publisher from accidentally using that reference as a native LinkedIn access token. Publish through Upload-Post until provider publishing is implemented. Unknown follower counts are not evidence of zero followers; only provider-returned counts are available at connection time.

If the provider profile is disconnected, needs reauthorization, or its Page selection changes, connection fails closed. Changing a binding requires reconnecting. Disconnecting in SocialVerse removes the local connection only; revoke provider access in Upload-Post or LinkedIn to end the provider authorization.

Primary references: https://docs.upload-post.com/api/user-profiles/ and https://docs.upload-post.com/api/linkedin-page

## Monitoring

`sync-account` and the existing scheduled `run-due-syncs` dispatcher support provider-managed LinkedIn Pages. Every read verifies the configured brand, pinned Page and original LinkedIn member. Media and engagement requests always specify the organization's URN; the provider's default organization must never be used.

Each sync imports up to 100 recent posts (the provider's LinkedIn API does not expose a pagination cursor), and refreshes live engagement for the latest 20 in batches of five. Captions, dates, media and post links are saved in the existing brand-scoped platform-post records. Follower totals are refreshed. Stored post count describes imported posts, not the Page's lifetime post total. Missing metrics do not overwrite previously fetched values; existing database defaults can appear for new posts without available counters, and sync reports this limitation. Daily analytics snapshots are not fabricated from rolling totals.

The existing five-minute cron checks each account's selected sync interval. Scheduling remains subject to provider availability and rate limits. Disconnect in SocialVerse and provider revocation are separate operations.

Monitoring references: https://docs.upload-post.com/api/instagram-media and https://docs.upload-post.com/api/get-analytics

Validation: 56 automated tests passed; lint completed with existing warnings. Deployment and live confirmation results are recorded in the task response.
