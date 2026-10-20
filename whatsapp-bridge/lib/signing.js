'use strict';
const crypto = require('node:crypto');

// Every callback to SocialVerse carries an HMAC of the exact body, keyed with
// the bridge API key (which SocialVerse also holds). SocialVerse refuses
// unsigned or mismatched callbacks, so nobody else can fake delivery results
// or opt-outs for someone's contacts.
function sign(body, key) {
  return 'sha256=' + crypto.createHmac('sha256', key).update(body).digest('hex');
}

function verify(body, header, key) {
  if (typeof header !== 'string') return false;
  const expected = Buffer.from(sign(body, key));
  const given = Buffer.from(header);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// Compares secrets without leaking their length or content through timing.
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = { sign, verify, safeEqual };
