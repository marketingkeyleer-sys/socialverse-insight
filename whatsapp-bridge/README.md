# SocialVerse WhatsApp bridge

A small multi-user service that holds QR-linked WhatsApp sessions (one per SocialVerse account) (the same "Linked devices" login as WhatsApp Web) and lets SocialVerse use it to:

- show you the QR code inside the app, so you link your phone from the **WhatsApp** tab
- list the WhatsApp **groups** on that number
- send a post to your **customers and groups**, one message at a time, at a pace you choose

It exists because a WhatsApp Web session needs a real Chromium and a process that stays running, which Supabase Edge Functions can't host. SocialVerse talks to it over HTTPS with a shared API key.

> **Risk.** This uses the unofficial `whatsapp-web.js` library. WhatsApp's terms don't allow automation like this, and numbers that message people who haven't opted in, or send too fast, can be restricted or banned. Use a number you can afford to lose. For a compliant route that can't reach groups, connect the official Cloud API instead (the other tab in SocialVerse's connect dialog).

## Set up once (you, the operator)

Your users never touch this. They click Connect on WhatsApp in SocialVerse, scan a QR code, and they're done. You run one bridge for everyone.

1. Create a Railway service from this folder (`railway.json` selects the Dockerfile, which installs Chromium).
2. Add a **volume at `/data`** and set `DATA_DIR=/data`. It holds every linked session.
3. Set `BRIDGE_API_KEY` (random, 24+ chars), `CALLBACK_URL` (your `.../functions/v1/whatsapp-webhook` address) and `MAX_SESSIONS`. See `.env.example`.
4. Keep **one replica**, and give it enough RAM for `MAX_SESSIONS` browsers. Generate a public HTTPS domain.
5. Give SocialVerse the address and key as project secrets, then redeploy nothing else:
   ```bash
   npx supabase secrets set WHATSAPP_BRIDGE_URL=https://your-bridge.up.railway.app WHATSAPP_BRIDGE_KEY=<same BRIDGE_API_KEY> --project-ref <ref>
   ```

## Run locally

```bash
npm install
cp .env.example .env   # set BRIDGE_API_KEY
npm start              # http://127.0.0.1:3000
npm test
```

SocialVerse can only reach a public HTTPS address, so local runs are for development and tests.

## API

Every `/api` route needs `Authorization: Bearer <BRIDGE_API_KEY>`. Only `/health` is open. `:id` is the SocialVerse account's UUID, one WhatsApp session each.

| Route | Purpose |
| --- | --- |
| `GET /health` | Health check |
| `GET /api/sessions/:id/status` | `{ state, qr, account, error }`. `state` is `disconnected`, `starting`, `qr`, `authenticating`, `ready` or `error`; `qr` is a PNG data URL |
| `POST /api/sessions/:id/start` / `restart` / `logout` | Control that number's session |
| `GET /api/sessions/:id/groups` | `{ groups: [{ id, name, size }] }` (needs `ready`) |
| `POST /api/jobs` | Queue a paced broadcast: `{ jobId, accountId, callbackUrl, text, mediaUrl?, pace, targets: [{ id, to, name? }] }` |
| `GET /api/jobs/:id` / `POST /api/jobs/:id/cancel` | Progress and cancel |

`to` is a phone number with country code, or a group id ending `@g.us`. `{name}` in `text` is replaced per contact. `mediaUrl` must be a public https JPG, PNG, MP4 or PDF (max 16 MB); private and internal addresses are refused.

**Pace**: `safe` 30-90 s between messages, `balanced` 8-25 s, `fast` 2-6 s (random within the range). Jobs from all numbers share one sender, so a busy server queues them in order.

**Callbacks**: after each message the bridge POSTs `{ accountId, jobId, events: [{ recipientId, status: "sent" | "failed", messageId?, error? }] }` to the job's `callbackUrl`, signed in the `x-bridge-signature` header (`sha256=` HMAC of the body, keyed with the API key). Undelivered results are kept and retried. A customer replying STOP is reported as `{ accountId, optOut: [phone] }`.

## Behaviour worth knowing

- Messages go out one at a time. A job survives restarts; a message that was mid-send when the process died is reported as failed rather than retried, to avoid a duplicate.
- Nothing sends while WhatsApp is disconnected; jobs wait and resume once it's linked again.
- A failed media download fails the whole job once instead of once per contact.
- At most 2000 targets per job.

## Layout

`server.js` wires it together. `lib/sessions.js` manages one session per account, `lib/session.js` is a single WhatsApp session, `lib/jobs.js` the paced queue, `lib/app.js` the HTTP API, `lib/safe-fetch.js` the media downloader (SSRF-guarded), `lib/signing.js` and `lib/callback.js` the signed callbacks. Tests are in `test/`.
