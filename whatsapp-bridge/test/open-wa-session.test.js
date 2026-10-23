'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { OpenWaSession } = require('../lib/open-wa-session');
const { SessionManager } = require('../lib/sessions');
const id = '12345678-1234-4234-8234-123456789012';
const next = () => new Promise(resolve => setImmediate(resolve));
function setup(t, overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'socialverse-openwa-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const events = new EventEmitter();
  let complete;
  const started = new Promise(resolve => { complete = resolve; });
  const calls = [];
  const client = {
    start: () => started,
    stop: async () => { calls.push('stop'); complete(); },
    getState: () => 'READY',
    getMe: async () => ({ pushname: 'Test brand' }),
    getHostNumber: async () => '919876543210@c.us',
    onMessage: () => ({ off() {} }),
    onStateChanged: () => ({ off() {} }),
    getAllChats: async () => [{ id: '12345@g.us', name: 'Customers', isGroup: true }, { id: '919876543210@c.us', isGroup: false }],
    sendText: async (...args) => { calls.push(args); return 'message-id'; },
    sendFile: async (...args) => { calls.push(args); return 'media-id'; },
    ...overrides,
  };
  const session = new OpenWaSession({ dataDir: directory, clientId: id,
    encodeQR: async value => `image:${value}`,
    clientFactory: async () => ({ client, core: { events, getReadiness: () => ({ exposureSafe: true }) } }),
  });
  t.after(() => session.stop());
  return { session, client, directory, events, complete, calls };
}
test('QR events remain scoped to their client and are removed when stopped', async t => {
  const a = setup(t);
  const b = setup(t);
  await a.session.start(); await b.session.start(); await next();
  a.events.emit('launch.auth.qr.generated', { details: { qr: 'private-a' } });
  await next();
  assert.equal(a.session.status().qr, 'image:private-a');
  assert.equal(b.session.status().qr, null);
  assert.equal(a.session.status().capabilities.pairingCode, false);
  await a.session.stop();
  assert.equal(a.events.listenerCount('launch.auth.qr.generated'), 0);
  a.events.emit('launch.auth.qr.generated', { details: { qr: 'stale' } });
  await next();
  assert.equal(a.session.status().qr, null);
  assert.equal(a.session.status().state, 'disconnected');
});
test('only a ready runtime records a linked session for restoration', async t => {
  const { session, directory, complete } = setup(t);
  const manager = new SessionManager({ dataDir: directory, engine: 'open-wa' });
  await session.start(); await next();
  assert.deepEqual(manager.savedIds(), []);
  complete(); await next();
  assert.equal(session.status().state, 'ready');
  assert.equal(session.status().account.phone, '919876543210');
  assert.deepEqual(manager.savedIds(), [id]);
  await session.stop();
  assert.deepEqual(manager.savedIds(), [id]);
  await session.stop({ logout: true });
  assert.deepEqual(manager.savedIds(), []);
});
test('stopping an unscanned QR cannot change back to ready on late completion', async t => {
  const { session, complete, calls } = setup(t);
  await session.start(); await next();
  await session.stop(); complete(); await next();
  assert.equal(session.status().state, 'disconnected');
  assert.equal(calls.filter(call => call === 'stop').length, 1);
});
test('group filtering, text and media use open-wa v5 call signatures', async t => {
  const { session, complete, calls } = setup(t);
  await session.start(); complete(); await next();
  assert.deepEqual(await session.groups(), [{ id: '12345@g.us', name: 'Customers', size: null }]);
  assert.deepEqual(await session.send('919876543210', 'Hello'), { id: 'message-id' });
  assert.equal(calls[0][0], '919876543210@c.us');
  await session.send('12345@g.us', 'Caption', { mimetype: 'image/png', data: 'aGVsbG8=', filename: 'post.png' });
  assert.deepEqual(calls[1], ['12345@g.us', 'data:image/png;base64,aGVsbG8=', 'post.png', { caption: 'Caption', type: 'image' }]);
});
test('a boolean send result cannot be reported as a successful message', async t => {
  const { session, complete } = setup(t, { sendText: async () => true });
  await session.start(); complete(); await next();
  await assert.rejects(session.send('919876543210', 'Hello'), /Check the chat before retrying/);
});
test('cannot send before pairing or create sessions outside UUID paths', async t => {
  const { session, directory } = setup(t);
  await assert.rejects(session.send('919876543210', 'Hello'), /not connected/);
  await assert.rejects(session.pairingCode(), /QR code/);
  assert.throws(() => new OpenWaSession({ dataDir: directory, clientId: '../other' }), /Invalid account/);
});
test('startup failure clears the old client and allows another attempt without exposing error payloads', async t => {
  const { session, client, directory } = setup(t, { start: async () => { throw new Error('private-token'); } });
  await session.start(); await next();
  assert.equal(session.status().state, 'error');
  assert.doesNotMatch(session.status().error, /private-token/);
  const diagnostic = fs.readFileSync(path.join(directory, 'open-wa', id, 'startup-diagnostic.json'), 'utf8');
  assert.doesNotMatch(diagnostic, /private-token/);
  client.start = async () => {};
  await session.start(); await next();
  assert.equal(session.status().state, 'ready');
});
test('expired QR pairing gives actionable feedback without retaining private SDK payloads', async t => {
  const { session, directory } = setup(t, { start: async () => { throw new Error('Timed out waiting for QR scan: private-token'); } });
  await session.start(); await next();
  assert.equal(session.status().state, 'error');
  assert.match(session.status().error, /pairing window expired/);
  const diagnostic = JSON.parse(fs.readFileSync(path.join(directory, 'open-wa', id, 'startup-diagnostic.json'), 'utf8'));
  assert.equal(diagnostic.category, 'qr-timeout');
  assert.equal(diagnostic.message, undefined);
  assert.doesNotMatch(JSON.stringify(diagnostic), /private-token/);
});
