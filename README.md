# SocialVerse

> Latest live backend/database status: [docs/LIVE_DEPLOYMENT_STATUS.md](docs/LIVE_DEPLOYMENT_STATUS.md).
> Additive database setup and backend deployment are complete; frontend hosting is pending.

> The current audit, configuration, migration, test results, and remaining
> production blockers are documented in [docs/AUDIT_AND_DEPLOYMENT.md](docs/AUDIT_AND_DEPLOYMENT.md).
> That document supersedes the older OAuth and deployment notes below.

A multi-user SaaS social media management platform. Any number of users can sign up, connect their own Facebook, Instagram, YouTube, and LinkedIn accounts, compose and schedule posts across every platform, and track analytics from a single dashboard. Every user's data is completely isolated via Supabase Row Level Security — no exceptions.

## Features

- **Email + Google auth** with email verification and a password-reset flow
- **Guided onboarding** — welcome, connect an account, quick tour
- **Multi-platform composer** with per-platform character limits, media upload, live preview, and scheduling
- **Post management** — drafts, scheduled, published, and failed posts with bulk actions and search/filter
- **Analytics dashboard** — follower growth, engagement rate, reach, top posts, CSV export
- **Account settings** — profile, password, plan/limits, activity log, self-service account deletion
- **Dark mode** everywhere, fully responsive (sidebar nav on desktop, bottom tab bar on mobile)

## Tech stack

- Vite + React 19 + TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui (Radix UI, Nova preset)
- React Router v6 for routing
- TanStack Query for data fetching/caching
- Supabase (Auth, Postgres, Row Level Security, Storage)
- Recharts for all charts
- Lucide React for icons

## Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```
2. Create a Supabase project at [supabase.com](https://supabase.com) (or use an existing one).
3. Copy `.env.example` to `.env.local` and fill in your project's URL and anon key:
   ```bash
   cp .env.example .env.local
   ```
4. Run the migrations against your Supabase project, in order — open the SQL Editor in the Supabase dashboard and run `supabase/migrations/001_initial_schema.sql` then `supabase/migrations/002_oauth_connect.sql` (or use the CLI: `npx supabase db push` once linked).

   > **Sharing a Supabase project with another app?** Every table, function, and trigger here is prefixed `sv_` (`sv_profiles`, `sv_connected_accounts`, `sv_posts`, ...) so it can't collide with another app's schema in the same project — safe to run alongside anything else already there. The one thing that *is* shared no matter what: `auth.users`. A user who signs up in one app has an account in both; deleting their account in one deletes it in both.
5. (Optional) Seed demo data — run `supabase/seed.sql` the same way. This creates 3 demo users (`demo1@socialhub.test`, `demo2@socialhub.test`, `demo3@socialhub.test`, password `DemoPass123!`) with 90 days of realistic analytics and 15-20 posts each.
6. Follow **OAuth setup** below to enable real account connections.
7. Start the dev server:
   ```bash
   npm run dev
   ```

## OAuth setup

Connecting Facebook, Instagram, YouTube, and LinkedIn accounts goes through two Supabase Edge Functions (`oauth-start`, `oauth-callback`) — the OAuth client secret can never live in the browser bundle, so the token exchange has to happen server-side. The client only ever calls `oauth-start` and gets redirected.

1. **Deploy the functions** (requires the [Supabase CLI](https://supabase.com/docs/guides/cli), logged in and linked to your project):
   ```bash
   npx supabase functions deploy oauth-start
   npx supabase functions deploy oauth-callback
   ```
2. **Set the Edge Function secrets** (Project Settings → Edge Functions → Secrets, or `npx supabase secrets set KEY=value`):
   - `OAUTH_ENCRYPTION_KEY` — any long random string; encrypts tokens at rest (AES-256-GCM). Generate one with `openssl rand -base64 32`.
   - `APP_URL` — your deployed app's origin, e.g. `https://app.example.com` (used as a fallback redirect target).
   - `META_CLIENT_ID` / `META_CLIENT_SECRET` — from a Meta App at [developers.facebook.com](https://developers.facebook.com) (covers both Facebook and Instagram, since Instagram Business accounts connect through a Facebook Page).
   - `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` — from a LinkedIn App at [linkedin.com/developers](https://www.linkedin.com/developers/apps).
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — an OAuth 2.0 Client ID (Web application type) from [console.cloud.google.com](https://console.cloud.google.com/apis/credentials), with the YouTube Data API v3 enabled.
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already available to every Edge Function automatically — no need to set them.
3. **Register the callback redirect URI** in each provider's developer console:
   - Meta (Facebook + Instagram): `https://<project-ref>.supabase.co/functions/v1/oauth-callback/facebook` and `.../instagram`
   - LinkedIn: `https://<project-ref>.supabase.co/functions/v1/oauth-callback/linkedin`
   - Google: `https://<project-ref>.supabase.co/functions/v1/oauth-callback/youtube`
4. Click **Connect** on the Accounts page — it redirects to the provider, then back into the app once approved.

The scopes requested are read/profile-only (`pages_show_list`, `instagram_basic`, `youtube.readonly`, etc.) — enough to verify identity and pull follower/analytics data. No posting scopes are requested, since the composer records posts locally rather than publishing to the real platforms.

## Folder structure

```
src/
  components/
    layout/       Sidebar, Navbar, mobile nav, route guard
    dashboard/     Overview page widgets
    accounts/      Platform connection cards
    composer/      Post editor, media upload, scheduling, preview
    posts/         Post list, filters, status badges
    analytics/     Charts and metric cards
    settings/      Profile, password, plan, activity, account deletion
    onboarding/    3-step wizard
    ui/            shadcn/ui primitives
  pages/           One file per route
  lib/             Supabase client, formatters, platform config
  hooks/           TanStack Query hooks per resource
  types/           Database and platform types
  contexts/        Auth + theme providers
supabase/
  migrations/      SQL schema + RLS policies
  seed.sql         Demo data generator
```

## Deployment

Any static host works (Vercel, Netlify, Cloudflare Pages) — this is a plain Vite SPA with no server component.

1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (and the OAuth app IDs, once wired up) as environment variables on your host.
2. Build: `npm run build` → deploy the `dist/` folder.
3. Configure your host to redirect all routes to `index.html` (SPA fallback), since this uses client-side routing.

## License

MIT
