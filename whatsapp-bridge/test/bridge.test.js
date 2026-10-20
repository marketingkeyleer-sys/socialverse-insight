'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { EventEmitter } = require('node:events');

const { normalizePhone, isGroupId } = require('../lib/phone');
const { sign, verify, safeEqual } = require('../lib/signing');
const { isPublicAddress, resolvePublic } = require('../lib/safe-fetch');
const { validateCallbackUrl } = require('../lib/callback');
const { JobQueue, delayFor, PACES } = require('../lib/jobs');
const { createApp } = require('../lib/app');
const { SessionManager } = require('../lib/sessions');

const NO_WAIT = { safe: [0, 0], balanced: [0, 0], fast: [0, 0] };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-test-'));
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function makeQueue(overrides = {}) {
  const sent = [];
  const reports = [];
  const queue = new JobQueue({
    dir: tmp(),
    isReady: () => true,
    sendOne: async (_job, target) => {
      sent.push(target.to);
      return { id: `msg-${target.id}` };
    },
    notify: async (_job, events) => reports.push(...events),
    paces: NO_WAIT,
    ...overrides,
  });
  // Tests drive step() by hand; the queue's own timer would race them.
  queue.stop();
  return { queue, sent, reports };
}

const job = (id, targets, extra = {}) => ({
  id,
  accountId: 'acct',
  callbackUrl: 'https://example.supabase.co/functions/v1/whatsapp-webhook',
  text: 'Hello {name}',
  pace: 'balanced',
  targets,
  ...extra,
});

async function drain(queue) {
  for (let i = 0; i < 50; i++) if ((await queue.step()) === null) return;
  assert.fail('queue never finished');
}

test('phone numbers: digits only, country code required, groups recognised', () => {
  assert.equal(normalizePhone('+91 98765-43210'), '919876543210');
  assert.throws(() => normalizePhone('0123456789'));
  assert.throws(() => normalizePhone('12345'));
  assert.equal(isGroupId('120363025246125486@g.us'), true);
  assert.equal(isGroupId('919876543210@c.us'), false);
});

test('signatures reject tampered bodies and wrong keys', () => {
  const body = JSON.stringify({ events: [1] });
  const header = sign(body, 'k'.repeat(32));
  assert.equal(verify(body, header, 'k'.repeat(32)), true);
  assert.equal(verify(body + ' ', header, 'k'.repeat(32)), false);
  assert.equal(verify(body, header, 'x'.repeat(32)), false);
  assert.equal(verify(body, undefined, 'k'.repeat(32)), false);
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abcd'), false);
});

test('media fetcher refuses private, loopback, link-local and non-https targets', async () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.9', '172.20.0.1', '169.254.169.254', '::1', 'fe80::1', '::ffff:10.0.0.1']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  assert.equal(isPublicAddress('8.8.8.8'), true);
  await assert.rejects(resolvePublic('http://example.com/a.png'), /HTTPS/);
  await assert.rejects(resolvePublic('https://127.0.0.1/a.png'), /private|local/);
  await assert.rejects(resolvePublic('https://user:pw@example.com/a.png'), /credentials|HTTPS/);
  await assert.rejects(resolvePublic('https://example.com:8443/a.png'), /port 443/);
});

test('callback URLs must be https and on the allowlist when one is set', () => {
  assert.throws(() => validateCallbackUrl('http://evil.test/x'), /https/);
  assert.throws(() => validateCallbackUrl('https://a.test/x', { allowlist: ['b.test'] }), /ALLOWLIST/);
  assert.ok(validateCallbackUrl('https://b.test/x', { allowlist: ['b.test'] }));
  assert.ok(validateCallbackUrl('http://localhost:54321/x', { allowInsecure: true }));
  assert.throws(() => validateCallbackUrl('http://evil.test/x', { allowInsecure: true }), /https/);
});

test('pace delays stay inside their range', () => {
  for (const pace of Object.keys(PACES)) {
    const [min, max] = PACES[pace];
    for (const r of [0, 0.5, 0.999999]) {
      const d = delayFor(PACES, pace, () => r);
      assert.ok(d >= min && d <= max, `${pace} ${d}`);
    }
  }
});

test('jobs send one at a time, in order, and report every result', async () => {
  const { queue, sent, reports } = makeQueue({
    sendOne: async (_j, t) => {
      if (t.to === '919800000002') throw new Error('not on WhatsApp');
      return { id: `m-${t.id}` };
    },
  });
  queue.create(job(uuid(1), [
    { id: 'a', to: '919800000001' },
    { id: 'b', to: '919800000002' },
    { id: 'c', to: '120363025246125486@g.us' },
  ]));
  await drain(queue);
  assert.deepEqual(reports, [
    { recipientId: 'a', status: 'sent', messageId: 'm-a' },
    { recipientId: 'b', status: 'failed', error: 'not on WhatsApp' },
    { recipientId: 'c', status: 'sent', messageId: 'm-c' },
  ]);
  const summary = queue.summary(queue.read(uuid(1)));
  assert.deepEqual([summary.state, summary.sent, summary.failed, summary.pending], ['completed', 2, 1, 0]);
  assert.equal(sent.length, 0); // custom sendOne in this test
});

test('creating the same job twice does not send twice', async () => {
  const { queue, sent } = makeQueue();
  const input = job(uuid(2), [{ id: 'a', to: '919800000001' }]);
  queue.create(input);
  queue.create(input);
  await drain(queue);
  assert.equal(sent.length, 1);
});

test('results that cannot be reported yet are kept and retried, not lost', async () => {
  let up = false;
  const reports = [];
  const { queue } = makeQueue({
    notify: async (_j, events) => {
      if (!up) throw new Error('SocialVerse is down');
      reports.push(...events);
    },
  });
  queue.create(job(uuid(3), [{ id: 'a', to: '919800000001' }]));
  await queue.step(); // sends, outbox now holds the result
  assert.equal(await queue.step(), 15000); // report fails -> retry later
  assert.equal(reports.length, 0);
  up = true;
  await drain(queue);
  assert.deepEqual(reports, [{ recipientId: 'a', status: 'sent', messageId: 'msg-a' }]);
});

test('nothing is sent while WhatsApp is disconnected', async () => {
  let ready = false;
  const { queue, sent } = makeQueue({ isReady: () => ready });
  queue.create(job(uuid(4), [{ id: 'a', to: '919800000001' }]));
  assert.equal(await queue.step(), 30000);
  assert.equal(sent.length, 0);
  ready = true;
  await drain(queue);
  assert.equal(sent.length, 1);
});

test('cancelling mid-send keeps the in-flight result and cancels the rest', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const { queue, reports } = makeQueue({ sendOne: async (_j, t) => { await gate; return { id: `m-${t.id}` }; } });
  queue.create(job(uuid(5), [{ id: 'a', to: '919800000001' }, { id: 'b', to: '919800000002' }, { id: 'c', to: '919800000003' }]));
  const stepping = queue.step();
  await new Promise((r) => setImmediate(r));
  queue.cancel(uuid(5));
  release();
  await stepping;
  await drain(queue);
  const saved = queue.read(uuid(5));
  assert.deepEqual(saved.targets.map((t) => t.status), ['sent', 'cancelled', 'cancelled']);
  assert.equal(saved.state, 'cancelled');
  assert.deepEqual(reports.map((e) => e.recipientId), ['a']);
});

test('a message that was mid-send when the process died is failed, not retried', async () => {
  const dir = tmp();
  const first = new JobQueue({ dir, isReady: () => true, sendOne: async () => ({ id: 'x' }), notify: async () => {}, paces: NO_WAIT });
  first.create(job(uuid(6), [{ id: 'a', to: '919800000001' }, { id: 'b', to: '919800000002' }]));
  const saved = first.read(uuid(6));
  saved.targets[0].status = 'sending';
  first.write(saved);
  first.stop();

  const sent = [];
  const reports = [];
  const second = new JobQueue({
    dir,
    isReady: () => true,
    sendOne: async (_j, t) => { sent.push(t.id); return { id: 'y' }; },
    notify: async (_j, events) => reports.push(...events),
    paces: NO_WAIT,
  });
  second.start();
  second.stop();
  await drain(second);
  assert.deepEqual(sent, ['b']);
  assert.equal(reports.find((e) => e.recipientId === 'a').status, 'failed');
  assert.match(reports.find((e) => e.recipientId === 'a').error, /duplicate/);
});

test('a media failure fails the whole job once instead of once per contact', async () => {
  let calls = 0;
  const { queue, reports } = makeQueue({
    sendOne: async () => {
      calls += 1;
      const error = new Error('Media file is larger than 16 MB.');
      error.fatalForJob = true;
      throw error;
    },
  });
  queue.create(job(uuid(7), [{ id: 'a', to: '919800000001' }, { id: 'b', to: '919800000002' }, { id: 'c', to: '919800000003' }]));
  await drain(queue);
  assert.equal(calls, 1);
  assert.equal(reports.length, 3);
  assert.ok(reports.every((e) => e.status === 'failed'));
});

const A1 = uuid(101);
const A2 = uuid(102);

function fakeSession(ready) {
  return Object.assign(new EventEmitter(), {
    status: () => ({ state: ready ? "ready" : "starting", qr: null, account: ready ? { name: "Shop", phone: "919800000000" } : null, error: "" }),
    start: async () => ({ state: "starting" }),
    restart: async () => ({ state: "starting" }),
    stop: async () => ({ state: "disconnected" }),
    isReady: () => ready,
    pairingCode: async (phone) => { if (!/^[0-9]{10,}$/.test(phone)) throw new Error('bad phone'); return 'ABCD-1234'; },
    groups: async () => [{ id: "1@g.us", name: "Customers", size: 5 }],
  });
}

async function withApp(fn, { ready = false, max = 10 } = {}) {
  const sessions = new SessionManager({ dataDir: tmp(), max, factory: () => fakeSession(ready) });
  const queue = new JobQueue({ dir: tmp(), isReady: () => ready, sendOne: async () => ({ id: "m" }), notify: async () => {}, paces: NO_WAIT });
  queue.stop();
  const app = createApp({ apiKey: "k".repeat(32), sessions, jobs: queue, callbackOptions: {} });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base, sessions);
  } finally {
    server.close();
  }
}

const auth = { Authorization: `Bearer ${"k".repeat(32)}`, "Content-Type": "application/json" };
const post = (url, body = {}) => fetch(url, { method: "POST", headers: auth, body: JSON.stringify(body) });

test("API: /health is open, everything under /api needs the key", async () => {
  await withApp(async (base) => {
    assert.equal((await fetch(`${base}/health`)).status, 200);
    assert.equal((await fetch(`${base}/api/sessions/${A1}/status`)).status, 401);
    assert.equal((await fetch(`${base}/api/sessions/${A1}/status`, { headers: { Authorization: "Bearer nope" } })).status, 401);
    const ok = await fetch(`${base}/api/sessions/${A1}/status`, { headers: auth });
    assert.equal((await ok.json()).state, "disconnected");
  });
});

test("API: each account gets its own session, ids must be UUIDs, capacity is capped", async () => {
  await withApp(async (base, sessions) => {
    assert.equal((await post(`${base}/api/sessions/../start`)).status, 404);
    assert.equal((await post(`${base}/api/sessions/not-a-uuid/start`)).status, 400);
    assert.equal((await post(`${base}/api/sessions/${A1}/start`)).status, 200);
    assert.equal((await post(`${base}/api/sessions/${A2}/start`)).status, 200);
    assert.equal(sessions.sessions.size, 2);
    assert.notEqual(sessions.get(A1), sessions.get(A2));
    assert.equal((await post(`${base}/api/sessions/${uuid(103)}/start`)).status, 503);
    assert.equal((await post(`${base}/api/sessions/${A1}/logout`)).status, 200);
    assert.equal(sessions.sessions.size, 1);
  }, { max: 2 });
});

test("API: pairing code needs a started session and a valid phone", async () => {
  await withApp(async (base) => {
    assert.equal((await post(`${base}/api/sessions/${A1}/pairing-code`, { phone: "919800000000" })).status, 409);
    await post(`${base}/api/sessions/${A1}/start`);
    assert.equal((await post(`${base}/api/sessions/${A1}/pairing-code`, { phone: "12" })).status, 400);
    const ok = await post(`${base}/api/sessions/${A1}/pairing-code`, { phone: "919800000000" });
    assert.equal((await ok.json()).code, "ABCD-1234");
  });
});

test("API: groups need a linked session", async () => {
  await withApp(async (base) => {
    assert.equal((await fetch(`${base}/api/sessions/${A1}/groups`, { headers: auth })).status, 409);
    await post(`${base}/api/sessions/${A1}/start`);
    const res = await fetch(`${base}/api/sessions/${A1}/groups`, { headers: auth });
    assert.deepEqual((await res.json()).groups, [{ id: "1@g.us", name: "Customers", size: 5 }]);
  }, { ready: true });
});

test("API: job validation rejects bad input and accepts a good job", async () => {
  await withApp(async (base) => {
    const good = {
      jobId: uuid(9), accountId: A1, callbackUrl: "https://x.supabase.co/hook", text: "Hi", pace: "safe",
      targets: [{ id: "r1", to: "+91 98765 43210" }, { id: "r2", to: "120363025246125486@g.us" }],
    };
    const send = (body) => post(`${base}/api/jobs`, body);
    assert.equal((await send({ ...good, text: "" })).status, 400);
    assert.equal((await send({ ...good, pace: "warp" })).status, 400);
    assert.equal((await send({ ...good, accountId: "nope" })).status, 400);
    assert.equal((await send({ ...good, mediaUrl: "http://x.test/a.png" })).status, 400);
    assert.equal((await send({ ...good, targets: [] })).status, 400);
    assert.equal((await send({ ...good, targets: [{ id: "r1", to: "123" }] })).status, 400);
    assert.equal((await send({ ...good, targets: [{ id: "r1", to: "919800000001" }, { id: "r1", to: "919800000002" }] })).status, 400);
    const accepted = await send(good);
    assert.equal(accepted.status, 202);
    assert.equal((await accepted.json()).total, 2);
    assert.equal((await fetch(`${base}/api/jobs/${uuid(9)}`, { headers: auth })).status, 200);
    assert.equal((await fetch(`${base}/api/jobs/${uuid(99)}`, { headers: auth })).status, 404);
  });
});
