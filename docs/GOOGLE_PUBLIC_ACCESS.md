# Public YouTube connections

Project: `evident-pipe-495610-f4` (YouTube Automation).
The registered client was visually matched to the client used by oauth-start.
Audience is already External. Public access is not yet verified.

## Applied on 20 October 2026

- Published commit `98f8039` through the existing Lovable Publish changes control.
- Verified `/privacy` and `/terms` on the live site without authentication.
- Saved the corrected SocialVerse name and both live policy URLs in Branding.
- Saved all three scopes below after explicit user approval.
- Published OAuth to Production after a separate explicit final confirmation.
  Google visibly reports External / In production, with 1 of 100 users for
  unapproved scopes. This removes the test-user-only gate but does not remove
  the unverified-app warning or cap.
- Started Google's automated branding verification. Google approval and
  sensitive-scope verification are separate from production publication.

Publish the application update before saving these consent-screen links:

- Homepage: https://socialverse-insight.lovable.app/
- Privacy: https://socialverse-insight.lovable.app/privacy
- Terms: https://socialverse-insight.lovable.app/terms
- Support/developer contact: marketingkeyleer@gmail.com
- Application name: SocialVerse

Public privacy and terms pages are implemented without authentication and
linked from landing, login, signup and the expanded application sidebar.
The operator should review the policy statements before publishing. These
pages do not certify that the application has passed Google's review.

Declare the existing requested scopes under Google Auth Platform → Data access:

| Scope | Why the app requests it |
| --- | --- |
| `https://www.googleapis.com/auth/youtube.readonly` | Discover the selected channel and display channel/video information and statistics. |
| `https://www.googleapis.com/auth/yt-analytics.readonly` | Display analytics for the channel the user authorizes. |
| `https://www.googleapis.com/auth/youtube.upload` | Upload videos when a user submits or schedules a YouTube post. |

Do not add broader permissions or declare functionality that is not working.
The exact callback registered on the Web client must remain:
`https://igdbgaroizwqaphdhimd.supabase.co/functions/v1/oauth-callback/youtube`.

Once the public links work, finish Branding, use Audience → Publish app, and
complete the Verification centre. Production publishing and verification are
separate steps. Unverified sensitive scopes can still show a warning and have
a user cap. A completed demo video and any ownership verification Google
requests must be supplied; approval cannot be guaranteed or bypassed in code.

Demo sequence: public homepage and policy links → application sign-in →
create/select own brand → Connect YouTube → Google account/channel selection
and consent showing the requested scopes → confirm the authorized channel →
view its data → demonstrate the upload function if requesting upload →
disconnect and show data-deletion controls. Do not expose passwords or tokens
in the recording, and do not publish real channel content merely for a demo.

Sources:
- https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- https://developers.google.com/youtube/terms/developer-policies
- https://support.google.com/cloud/answer/15549945
