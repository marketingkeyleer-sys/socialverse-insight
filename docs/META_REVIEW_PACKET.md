# Meta App Review preparation for SocialVerse

Checked 20 October 2026. This packet is preparation, not an approval or a submitted application.

## Correct application

The published SocialVerse Instagram OAuth URL identifies app **975939348747280**, display name **Dhivya**. The developer dashboard marks this app **Published**. It is connected to the **verified Keyleerkart business portfolio**. Its App Review request is **Not submitted**. Page permissions including pages_show_list, pages_read_engagement, pages_manage_posts and read_insights are shown as Ready for testing, rather than approved customer-wide access.

There is another Dhivya app, **1484534502769995**, which is unpublished. The user initially selected that app. Its privacy/terms/deletion URLs and Business and pages category were saved with explicit approval. These changes do not configure the production OAuth application. Do not confuse the two apps or replace production OAuth credentials with this other app's credentials.

The production review's app-settings step initially used https://www.robotverse.in/dashboard/privacy and https://www.facebook.com/ for deletion. The user explicitly approved replacing both with https://socialverse-insight.lovable.app/privacy. Both values were saved and verified after reloading the submission and reopening its app-settings step on 20 October 2026.

The current wizard reports Verification, App settings, Data handling and Reviewer instructions at 100%; Allowed usage is 0%. These completion indicators do not establish that the business's earlier answers are accurate or that Meta has approved them. Existing data-handling and reviewer instructions have not been replaced or newly attested by this work.

The owner explicitly chose to keep all 25 existing requests. None was removed. Usage descriptions were saved as incomplete drafts for pages_show_list, pages_read_engagement, instagram_basic, read_insights, pages_manage_posts, pages_messaging, ads_read, ads_management, whatsapp_business_messaging and whatsapp_business_management. Allowed-use agreement checkboxes were left unchecked; no new compliance agreement or final submission was made. Genuine recordings incorporating OAuth are still required. The pages_messaging draft also needs a controlled test Page and reviewer reproduction instructions.

The permission dialogs mark API tests Completed for pages_read_engagement, instagram_basic, read_insights, pages_manage_posts, pages_messaging, ads_read and ads_management. These are Meta's existing indicators, not a claim that this work ran those tests or demonstrated all features end to end.

WhatsApp messaging also shows its existing API test as Completed. Its business description identifies SocialVerse as a brand, content, analytics and authorized-conversation management product. The custom draft describes approved-template Cloud API messaging to opted-in contacts and delivery webhooks, explicitly distinguishing the QR bridge. Meta's generated suggestion was not accepted: it introduced unsupported claims about onboarding several businesses and registering phone numbers.

The WhatsApp business-management draft describes only the implemented WABA membership check, business phone information and approved-template reads. It does not claim to create WABAs or register new numbers. Its existing API test indicator also reads Completed. Both WhatsApp saves returned to the permission list. Reopening can trigger a delayed Meta suggestion/loading dialog.

## Existing draft scope

The existing production review draft includes many features beyond connecting Facebook/Instagram: advertising, fundraising, catalogs, Threads, WhatsApp, live video and messaging. They have NOT been removed or submitted. Do not attest that all are implemented and reviewed merely to pass the wizard.

For the existing Facebook Login connection route, the source defaults are public_profile, pages_show_list, pages_read_engagement and instagram_basic. Server configuration can override defaults. instagram_business_basic belongs to the separate Instagram Login route and is not a substitute for instagram_basic in the current flow.

Keep all existing requests unless the owner changes that instruction. Publishing and deeper analytics may require additional reviewed permissions; do not broaden OAuth scopes just to make the review form look complete.

The audited source does not demonstrate fundraising, Threads, catalogs, Ads MCP, lead retrieval, Instagram comment moderation or live streaming. The owner supplied the SocialVerse homepage when asked for feature URLs, but that does not establish these workflows or example charities. Retain these requests incomplete rather than invent descriptions or evidence. The separate instagram_business_* permissions use Instagram Login, whereas the implemented connection registry uses Facebook Login.

Meta's publish_video dialog explicitly describes live-video streaming. Existing regular video uploads through the Page videos endpoint do not substantiate this live-streaming request. Its dialog was inspected and left unchanged.

## Draft usage descriptions (review before submitting)

### pages_show_list

SocialVerse lets a signed-in business user choose a brand workspace and connect a Facebook Page or linked professional Instagram account they are authorized to manage. We request the user's manageable Pages so the user can explicitly select the correct asset. The user reviews the authorized account list in SocialVerse and confirms a selection before it is stored as a connected account. This avoids assigning an account to another company by mistake.

### pages_read_engagement

SocialVerse reads the authorized Page's identity, follower information and available published content to display the selected brand's connected channel and performance reports. The interface keeps Page data separated by brand and account. The user can disconnect the account from Accounts. Metric availability depends on the permissions and fields the provider returns; the application does not manufacture unavailable reach values.

### instagram_basic

SocialVerse uses the current Facebook Login integration to discover a Business or Creator Instagram account linked to a Page the user manages. It displays that account's identity, follower count and available media in the selected brand workspace and analytics report. The user explicitly confirms the account to connect. Personal Instagram accounts are directed to professional-account setup rather than represented as API-manageable consumer accounts.

## Demonstration recording checklist

Use genuine recordings of a controlled account and assets the owner is authorized to manage. Do not use a fabricated OAuth recording or claim screenshots replace a requested screencast.

1. Sign in to https://socialverse-insight.lovable.app using a dedicated reviewer account.
2. Open Accounts and select a brand with a vacant destination for the platform. The existing model permits one account per platform per brand.
3. Click Add Facebook Page, show the setup guide, then Continue with Facebook.
4. Show Meta's permission and asset-selection screens. Authorize only the demonstration Page(s). Do not record passwords, OTPs or tokens.
5. Return to SocialVerse, demonstrate the searchable account picker and explicitly confirm the account.
6. Show that the Page name and audience belong to that brand's dashboard and analytics report.
7. Repeat for a professional Instagram account linked to a managed Page.
8. Demonstrate date/platform filters and distinct channel data. Explain dashes for unavailable metrics.
9. Demonstrate disconnecting the controlled account. Do not delete production accounts or user data as a demonstration without authorization.

For pages_manage_posts or other write permissions, a separate real demonstration of that feature is required. This work has not published a real social post for review.

## Reviewer instructions draft

Website: https://socialverse-insight.lovable.app
Privacy and deletion instructions: https://socialverse-insight.lovable.app/privacy
Terms: https://socialverse-insight.lovable.app/terms

Provide a dedicated reviewer login through Meta's secure review form after the owner explicitly authorizes creating that account and sharing its credentials with Meta. Do not reuse the owner's production administrator password. Record the brand name and controlled Meta assets the reviewer should use. No reviewer login was created or shared during this work.

Reviewer path: sign in → Accounts → select a brand → Add Facebook Page or Add Instagram → follow the guide → Continue with Facebook → authorize managed assets → select the authorized account in SocialVerse → Connect selected → Dashboard/Analytics. Instagram requires Business/Creator with a linked Page for this implementation. Personal Facebook profiles are sign-in identities, not Page publishing destinations.

## Owner information still required

- Genuine feature demonstration recordings for each permission included in the final submission.
- Check the existing reviewer instructions (shown complete). If replacement access is needed, provide a dedicated reviewer account and explicit authorization to share those credentials with Meta.
- Accurate answers to Meta's data-handling and compliance questions, including all processors, retention/deletion practices and any legal-request history. Source code alone cannot establish these business facts.
- Review and acceptance of any policy/contract attestations by an authorized person.
- Final action-time approval before submitting an access-expansion request, if required by browser policy.

Only Meta can approve the requested permission access. Published mode and verified business status do not by themselves mean the app is approved for every customer's assets.

## Remaining broad-request evidence

All 25 requests remain. No scope, role or live permission was expanded during drafting.

| Request group | Remaining evidence |
| --- | --- |
| Page discovery, Page reads, Instagram basic, Insights | Genuine OAuth, asset selection and dashboard recordings; authorized-person allowed-use agreement |
| Page publishing | Controlled Page publishing demonstration and agreement |
| Page messaging | Controlled real Facebook tester and Page, reviewer access and reproduction instructions, genuine conversation/reply recording and agreement |
| Ads read/manage | Authorized advertising account demonstration without unapproved spend; agreement |
| WhatsApp messaging/management | Controlled WABA, number, approved template and opted-in test recipient; genuine Cloud API setup and use recording; agreement |
| pages_manage_metadata | Verify actual Page webhook subscription/metadata workflow and demonstrate it |
| pages_manage_ads / Marketing API Access Tier | Establish precise Page-ad workflow and access-tier justification; demonstrate it |
| business_management | Identify the Business Management operations requiring this broad permission; do not justify it solely with Page selection |
| instagram_business_basic / instagram_business_manage_messages | Establish and demonstrate the separate Instagram Login implementation |
| instagram_manage_comments / leads_retrieval | Implement or identify actual moderation and lead-retrieval workflows and provide evidence |
| manage_fundraisers | Actual charity names, authorized fundraising feature and business purpose |
| catalog_management / threads_basic / ads_mcp_management | Actual implemented feature URLs, purpose and genuine demonstrations |
| publish_video / Live Video API | Actual live-streaming implementation and demonstration; regular video uploads do not establish live streaming |
| public_profile | Existing completed response left unchanged |
