# LinkedIn Page connections through Upload-Post

The existing authorized provider profile can be attached to a SocialVerse brand using server-only configuration. This release supports connection and account confirmation, not provider publishing or historical analytics.

Set `UPLOAD_POST_API_KEY` as an Edge Function secret. Set `UPLOAD_POST_LINKEDIN_BINDINGS` to a JSON array of `{userId, brandId, profile, pageId}` records. Use the owner's immutable Supabase UUID, the owned brand UUID, the provider profile username, and an organization URN such as `urn:li:organization:123`. Never accept these bindings from client requests. Other brands retain the existing native LinkedIn flow.

`oauth-start` authenticates the owner, checks the brand, retrieves only its configured provider profile, checks reauthorization status, and verifies that the pinned Page matches the configured destination. It creates a pending connection using existing storage. `oauth-accounts` repeats the provider checks before the existing atomic confirmation RPC saves the selected Page. No schema changes or migration execution are required.

The saved encrypted reference identifies the provider profile, member, owner, brand and Page; it does not contain the global API key. The scope marker `socialverse:upload-post` prevents the publisher from accidentally using that reference as a native LinkedIn access token. Publish through Upload-Post until provider publishing is implemented. Unknown follower counts are not evidence of zero followers; only provider-returned counts are available at connection time.

If the provider profile is disconnected, needs reauthorization, or its Page selection changes, connection fails closed. Changing a binding requires reconnecting. Disconnecting in SocialVerse removes the local connection only; revoke provider access in Upload-Post or LinkedIn to end the provider authorization.

Primary references: https://docs.upload-post.com/api/user-profiles/ and https://docs.upload-post.com/api/linkedin-page

Validation: 55 automated tests passed, frontend production build passed, lint completed with existing warnings. Deployment and live confirmation results are recorded in the task response.
