import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportRange, previousRange, dateKey, channelReport, postsInRange, percentChange } from '../src/lib/analyticsReport.ts';
test('calendar presets include complete local days and Monday week boundaries', () => {
 const now = new Date(2026,9,20,13,45);
 const today=reportRange('today',now); assert.equal(today.from.getHours(),0); assert.equal(today.to.getHours(),23);
 assert.equal(dateKey(reportRange('yesterday',now).from),'2026-10-19');
 assert.equal(dateKey(reportRange('week',now).from),'2026-10-19');
 assert.equal(dateKey(reportRange('month',now).from),'2026-10-01');
 const last=reportRange('7',now); assert.equal(dateKey(last.from),'2026-10-14');
 const previous=previousRange(last); assert.equal(dateKey(previous.from),'2026-10-07'); assert.equal(dateKey(previous.to),'2026-10-13');
});
test('custom end day includes evening posts and excludes neighboring days', () => {
 const range=reportRange('today',new Date(2026,9,20));
 const posts=[{posted_at:new Date(2026,9,20,23,59,59).toISOString()},{posted_at:new Date(2026,9,21).toISOString()},{posted_at:new Date(2026,9,19,23).toISOString()}];
 assert.equal(postsInRange(posts,range).length,1);
});
test('channel report isolates accounts, compares equal periods and preserves unavailable values', () => {
 const range=reportRange('today',new Date(2026,9,20));
 const snapshot=(id,date,followers)=>({connected_account_id:id,metric_date:date,followers});
 const post=(id,date,reach)=>({connected_account_id:id,posted_at:new Date(2026,9,date,12).toISOString(),reach,likes_count:4,comments_count:2,shares_count:1,views_count:5});
 const rows=channelReport([{id:'a'},{id:'b'},{id:'c'}],[snapshot('a','2026-10-19',100),snapshot('a','2026-10-20',110),snapshot('b','2026-10-20',900)], [post('a',20,20),post('a',19,10),post('b',20,null)],range);
 assert.equal(rows[0].followers,110);assert.equal(rows[0].growth,10);assert.equal(rows[0].followersChange,10);assert.equal(rows[0].posts,1);assert.equal(rows[0].reachChange,100);assert.equal(rows[0].engagements,7);
 assert.equal(rows[1].followers,900);assert.equal(rows[1].growth,null);assert.equal(rows[1].reach,null);
 assert.equal(rows[2].followers,null); assert.equal(rows[2].engagements,null); assert.equal(rows[2].posts,0);
 assert.equal(percentChange(20,0),null);
});
