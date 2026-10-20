import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDERS } from '../supabase/functions/_shared/providers.ts';

test('YouTube discovery keeps all authorized channels across pages without duplicates', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    const parsed = new URL(url);
    calls.push(parsed);
    return Response.json(parsed.searchParams.has('pageToken')
      ? { items: [{ id: 'two', snippet: { title: 'Second brand' } }, { id: 'one' }] }
      : { items: [{ id: 'one', snippet: { title: 'First brand' } }], nextPageToken: 'next' });
  });
  const channels = await PROVIDERS.youtube.userInfo('private-token');
  assert.deepEqual(channels.map(channel => channel.id), ['one', 'two']);
  assert.equal(calls[1].searchParams.get('pageToken'), 'next');
  assert.ok(calls.every(url => url.origin === 'https://youtube.googleapis.com' && !url.searchParams.has('access_token')));
});

test('Meta discovery follows pagination and rejects off-origin credential forwarding', async (t) => {
  let count = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    count++;
    return Response.json({ data: [{ id: 'page' }], paging: { next: 'https://attacker.example/collect' } });
  });
  await assert.rejects(PROVIDERS.facebook.userInfo('private-token'), /Invalid account pagination URL/);
  assert.equal(count, 1);
});

test('repeated provider pagination cannot loop indefinitely', async (t) => {
  let count = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    count++;
    return Response.json({ items: [{ id: 'channel' }], nextPageToken: 'same' });
  });
  await assert.rejects(PROVIDERS.youtube.userInfo('private-token'), /could not finish/);
  assert.equal(count, 2);
});

test('permission and expired-token errors are actionable without reflecting provider secrets', async (t) => {
  for (const [status, code, expected] of [[403, 10, /application owner/], [400, 190, /expired or was revoked/], [429, 4, /limiting requests/]]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { code, message: 'private-token' } }, { status }));
    await assert.rejects(PROVIDERS.facebook.userInfo('private-token'), error => expected.test(error.message) && !error.message.includes('private-token'));
    mock.mock.restore();
  }
});
