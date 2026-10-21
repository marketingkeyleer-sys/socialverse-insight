import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manualDraft, manualPlatform, manualReminder } from '../src/lib/manualPublishing.ts';

test('personal-account drafts have no automated destinations or scheduled jobs', () => {
  for (const platform of ['facebook', 'instagram']) {
    const post = manualDraft(platform, 'My caption', ' A draft ', ['https://example.com/image.jpg'], 'brand-A');
    assert.equal(post.brand_id, 'brand-A');
    assert.equal(post.status, 'draft');
    assert.deepEqual(post.platforms, []);
    assert.deepEqual(post.connected_account_ids, []);
    assert.equal(post.scheduled_at, null);
    assert.equal(post.published_at, null);
    assert.equal(manualPlatform(post.tags), platform);
  }
  assert.throws(() => manualDraft('facebook', ' ', '', [], null), /caption or media/);
  assert.equal(manualPlatform(['campaign']), null);
});

test('calendar reminders preserve absolute time and contain a draft link rather than the caption', () => {
  const now = new Date('2026-10-21T10:00:00Z');
  const ics = manualReminder(new Date('2026-10-22T10:30:00+05:30'), 'instagram', 'draft-a', 'https://app.example.com', now);
  assert.match(ics, /DTSTART:20261022T050000Z/);
  assert.match(ics, /DTEND:20261022T051500Z/);
  assert.match(ics.replace(/\r\n /g, ''), /https:\/\/app.example.com\/manual-publish\?id=draft-a/);
  assert.match(ics, /BEGIN:VALARM/);
  assert.match(ics, /TRIGGER:-PT5M/);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.throws(() => manualReminder(now, 'facebook', 'draft-a', 'https://app.example.com', now), /future/);
  assert.throws(() => manualReminder(new Date('invalid'), 'facebook', 'draft-a', 'https://app.example.com', now), /future/);
});

test('calendar identifiers cannot inject new properties and exported lines stay within 75 bytes', () => {
  const ics = manualReminder(new Date('2030-01-01'), 'facebook', 'x\r\nSUMMARY:injected😀'.repeat(10), 'https://app.example.com', new Date('2026-01-01'));
  assert.equal(ics.split('\r\n').filter(line => line.startsWith('SUMMARY:')).length, 1);
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75);
});
