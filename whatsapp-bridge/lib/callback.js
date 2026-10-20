'use strict';
const { sign } = require('./signing');

// Delivers a signed JSON event to SocialVerse. Throws on any non-2xx so the
// caller keeps the event and retries rather than assuming it arrived.
async function postSigned(url, payload, key, fetchImpl = fetch) {
  const body = JSON.stringify(payload);
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bridge-signature': sign(body, key) },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`SocialVerse callback returned HTTP ${response.status}`);
}

// Only the hosts you list (comma separated, e.g. your Supabase project host)
// can receive callbacks. Without this, anyone holding the API key could make
// the bridge POST to any address.
function validateCallbackUrl(value, { allowlist = [], allowInsecure = false } = {}) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new Error('callbackUrl must be a valid URL.');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(allowInsecure && local)) throw new Error('callbackUrl must use https.');
  if (url.username || url.password) throw new Error('callbackUrl must not contain credentials.');
  if (allowlist.length > 0 && !allowlist.includes(url.hostname.toLowerCase())) {
    throw new Error('callbackUrl host is not in CALLBACK_HOST_ALLOWLIST.');
  }
  return url.href;
}

module.exports = { postSigned, validateCallbackUrl };
