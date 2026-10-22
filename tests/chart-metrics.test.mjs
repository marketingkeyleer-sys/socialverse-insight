import {test} from 'node:test';
import assert from 'node:assert/strict';
import {snapshotSeries,hasSnapshotMetric,postEngagementSeries} from '../src/lib/chartMetrics.ts';

test('a real LinkedIn follower observation renders one point without inventing reach or past history',()=>{
 const snapshot={platform:'linkedin_page',metric_date:'2026-10-22',followers:444,reach:0,impressions:0,available_metrics:['followers']};
 assert.deepEqual(snapshotSeries([snapshot],'followers'),{platforms:['linkedin_page'],data:[{date:'2026-10-22',linkedin_page:444}]});
 assert.deepEqual(snapshotSeries([snapshot],'reach'),{platforms:[],data:[]});
 assert.equal(hasSnapshotMetric(snapshot,'engagement_rate'),false);
 assert.equal(hasSnapshotMetric({...snapshot,available_metrics:null},'reach'),true);
});
test('multiple channels aggregate per platform without filling gaps or losing real zeros',()=>{
 const rows=[{platform:'linkedin_page',metric_date:'2026-10-22',followers:444},{platform:'linkedin_page',metric_date:'2026-10-22',followers:1482},{platform:'facebook',metric_date:'2026-10-21',followers:0}];
 assert.deepEqual(snapshotSeries(rows,'followers').data,[{date:'2026-10-21',facebook:0},{date:'2026-10-22',linkedin_page:1926}]);
});
test('post engagement groups lifetime counters by publication day rather than claiming daily reach',()=>{
 const data=postEngagementSeries([{posted_at:'2026-10-22T10:00:00Z',likes_count:8,comments_count:2,shares_count:1},{posted_at:'2026-10-22T11:00:00Z',likes_count:3,comments_count:0,shares_count:2}]);
 assert.deepEqual(data,[{date:'2026-10-22',likes:11,comments:2,shares:3}]);
});
