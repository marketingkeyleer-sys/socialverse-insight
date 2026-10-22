import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localDayKey, scheduleTimestamp, POST_CACHE_KEYS} from '../src/lib/scheduling.ts';

test('calendar groups events by local date across UTC midnight', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'Asia/Kolkata';
  try {
    assert.equal(localDayKey('2026-10-21T20:00:00Z'), '2026-10-22');
    assert.equal(localDayKey(new Date(2026,9,22)), '2026-10-22');
    const date = new Date(2026,9,22);
    assert.equal(scheduleTimestamp(date,'00:30',Date.parse('2026-10-21T10:00:00Z')), '2026-10-21T19:00:00.000Z');
    assert.equal(date.getHours(),0);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('invalid or past scheduling times cannot be saved', () => {
  const date = new Date('2026-10-22T00:00:00Z');
  for (const time of ['24:00','09:90','','9:00']) assert.throws(()=>scheduleTimestamp(date,time,0),/valid/);
  assert.throws(()=>scheduleTimestamp(undefined,'09:00',0),/valid/);
  assert.throws(()=>scheduleTimestamp(date,'09:00',Date.parse('2026-10-24T00:00:00Z')),/future/);
  for (const key of ['posts','post','calendar-posts','upcoming-posts']) assert.ok(POST_CACHE_KEYS.includes(key));
});
