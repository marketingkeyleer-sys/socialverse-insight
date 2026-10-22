'use strict';
const fs = require('node:fs');
const path = require('node:path');
require('dotenv/config');
// Do not advertise a usable bridge when its selected engine cannot load.
if (process.env.WHATSAPP_ENGINE === 'open-wa') require('@open-wa/wa-automate');
const { SessionManager } = require('./lib/sessions');
const { JobQueue } = require('./lib/jobs');
const { createApp } = require('./lib/app');
const { postSigned } = require('./lib/callback');
const { fetchMedia } = require('./lib/safe-fetch');

const apiKey = process.env.BRIDGE_API_KEY || '';
if (apiKey.length < 24) {
  console.error('Set BRIDGE_API_KEY to a random string of at least 24 characters (it signs every request and callback).');
  process.exit(1);
}

const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });

// Where results and STOP replies are reported. The allowlist defaults to this
// URL's own host, so the bridge only ever calls back to SocialVerse.
const callbackUrl = process.env.CALLBACK_URL || '';
const allowlist = (process.env.CALLBACK_HOST_ALLOWLIST || (callbackUrl ? new URL(callbackUrl).hostname : ''))
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);
const callbackOptions = { allowlist, allowInsecure: process.env.ALLOW_INSECURE_CALLBACK === 'true' };

// A customer replying STOP to a broadcast must stop receiving them. The reply
// arrives outside any job, so it goes to CALLBACK_URL for that account.
const OPT_OUT = /^\s*(stop|stop all|unsubscribe|opt[- ]?out|cancel)\s*[.!]?\s*$/i;
const sessions = new SessionManager({
  dataDir,
  max: Number(process.env.MAX_SESSIONS || 10),
  onIncoming: (accountId, { phone, text }) => {
    if (!callbackUrl || !OPT_OUT.test(text)) return;
    postSigned(callbackUrl, { accountId, optOut: [phone] }, apiKey).catch((error) => {
      console.error('Could not report an opt-out to SocialVerse:', error.message);
    });
  },
});

// A job's media is downloaded once and reused for every recipient. A failed
// download is fatal for the whole job (see jobs.js), not retried per contact.
const mediaByJob = new Map();
function mediaFor(job) {
  if (!mediaByJob.has(job.id)) {
    const pending = fetchMedia(job.mediaUrl).catch((error) => {
      mediaByJob.delete(job.id);
      error.fatalForJob = true;
      throw error;
    });
    mediaByJob.set(job.id, pending);
    if (mediaByJob.size > 20) mediaByJob.delete(mediaByJob.keys().next().value);
  }
  return mediaByJob.get(job.id);
}

const jobs = new JobQueue({
  dir: dataDir,
  isReady: (job) => Boolean(sessions.get(job.accountId)?.isReady()),
  sendOne: async (job, target) => {
    const session = sessions.get(job.accountId);
    if (!session) throw new Error('This WhatsApp number is not linked.');
    const media = job.mediaUrl ? await mediaFor(job) : null;
    const text = job.text.replaceAll('{name}', target.name || 'there');
    return session.send(target.to, text, media);
  },
  notify: (job, events) => postSigned(job.callbackUrl, { accountId: job.accountId, jobId: job.id, events }, apiKey),
});

const app = createApp({ apiKey, sessions, jobs, callbackOptions });
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

const server = app.listen(port, host, () => {
  console.log(`WhatsApp bridge listening on ${host}:${port}`);
  jobs.start();
  // Reconnect every previously linked number after a restart, one at a time
  // so a dozen Chromium instances don't all launch at once.
  sessions.savedIds().forEach((id, i) => {
    setTimeout(() => {
      try {
        sessions.ensure(id).start();
      } catch (error) {
        console.error(`Could not restore session ${id}:`, error.message);
      }
    }, i * 8000).unref();
  });
});

async function shutdown() {
  jobs.stop();
  server.close();
  await sessions.stopAll();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('message', (message) => { if (message === 'shutdown') void shutdown(); });
