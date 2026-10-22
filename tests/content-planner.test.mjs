import {test} from 'node:test';
import assert from 'node:assert/strict';
import {campaignSlots,zonedTimestamp,campaignAccountIssue} from '../supabase/functions/_shared/campaign-policy.ts';
import {runCampaignWorker} from '../supabase/functions/_shared/campaign-worker.ts';
const now=Date.parse('2026-10-22T00:00:00Z');
const config={startDate:'2026-10-23',months:1,weekdays:[1,3,5],time:'10:00',timezone:'Asia/Kolkata'};
test('month/year plans create future slots on the selected weekdays without changing local publishing time',()=>{
 const slots=campaignSlots(config,now);
 assert.equal(slots[0],'2026-10-23T04:30:00.000Z');
 assert.equal(slots.length,13);
 assert.equal(new Set(slots).size,slots.length);
 assert.ok(slots.every(slot=>[1,3,5].includes(new Date(slot).getUTCDay())));
 const year=campaignSlots({...config,months:12,weekdays:[0,1,2,3,4,5,6]},now);
 assert.equal(year.length,365);
 assert.equal(year.at(-1),'2027-10-22T04:30:00.000Z');
});
test('calendar bounds, leap years and daylight-saving gaps are handled explicitly',()=>{
 assert.equal(campaignSlots({...config,startDate:'2028-01-31',weekdays:[0,1,2,3,4,5,6]},Date.parse('2028-01-01')).length,29);
 assert.equal(zonedTimestamp('2027-03-13','10:00','America/New_York'),'2027-03-13T15:00:00.000Z');
 assert.equal(zonedTimestamp('2027-03-14','10:00','America/New_York'),'2027-03-14T14:00:00.000Z');
 assert.throws(()=>zonedTimestamp('2027-03-14','02:30','America/New_York'),/does not exist/);
 assert.throws(()=>campaignSlots({...config,startDate:'2026-02-30'},now),/Invalid start date/);
 assert.throws(()=>campaignSlots({...config,weekdays:[]},now),/weekdays/);
 assert.throws(()=>campaignSlots({...config,months:6},now),/month\/year/);
 assert.match(campaignAccountIssue({platform:'youtube'},true),/real video/);
 assert.match(campaignAccountIssue({platform:'instagram'},false),/image generation/);
});
function database({accountBrand='brand',scopes=['w_organization_social'],used=1,cached=false}={}) {
 const item={id:'item',campaign_id:'plan',user_id:'owner',account_id:'account',publish_at:'2027-01-10T04:30:00Z',status:'generating',lease_token:'lease',content:cached?'Saved caption #Company':null,media_urls:[]};
 const tables={sv_brands:[{id:'brand',user_id:'owner',name:'RobotVerse'}],sv_campaign_items:[{...item}],sv_content_campaigns:[{id:'plan',user_id:'owner',brand_id:'brand',status:'active',brief:'A robotics company teaching safe industrial automation.',with_images:false}],sv_connected_accounts:[{id:'account',user_id:'owner',brand_id:accountBrand,platform:'linkedin_page',is_active:true,scopes}]};
 const calls=[];
 return {tables,calls,async rpc(name,args){calls.push({name,args});if(name==='sv_claim_campaign_item')return {data:[{...item}]};if(name==='sv_reserve_ai_request')return{data:used};if(name==='sv_finish_campaign_item')return{data:'post'};throw new Error('unexpected RPC');},from(table){let filters=[];let payload;let maximum=Infinity;const query={select(){return query;},update(value){payload=value;return query;},eq(key,value){filters.push(row=>row[key]===value);return query;},not(key,_operator,value){filters.push(row=>row[key]!==value);return query;},order(){return query;},limit(value){maximum=value;return query;},async execute(single=false){const rows=(tables[table]??[]).filter(row=>filters.every(filter=>filter(row))).slice(0,maximum);if(payload)rows.forEach(row=>Object.assign(row,payload));return{data:single?rows[0]:rows,error:null};},single(){return query.execute(true);},then(resolve,reject){return query.execute().then(resolve,reject);}};return query;}};
}
globalThis.Deno={env:{get:key=>key==='OPENAI_API_KEY'?'test-key':undefined}};
test('cross-brand or read-only destinations stop before paid generation and pause the plan',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('Must not call provider');};
 try{for(const settings of [{accountBrand:'another-brand'},{scopes:['r_organization_social']}]){const db=database(settings);const result=await runCampaignWorker(db);assert.equal(result.failed,true);assert.equal(db.tables.sv_content_campaigns[0].status,'paused');assert.equal(db.calls.some(call=>call.name==='sv_reserve_ai_request'),false);}}
 finally{globalThis.fetch=original;}
});
test('hourly quota exhaustion defers without creating a post or calling the provider',async()=>{
 const db=database({used:-1});const result=await runCampaignWorker(db);
 assert.equal(result.deferred,true);assert.equal(db.tables.sv_campaign_items[0].status,'pending');assert.equal(db.calls.some(call=>call.name==='sv_finish_campaign_item'),false);
});
test('provider quota failure pauses a plan and keeps private provider diagnostics out of stored errors',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:{message:'private billing details'}},{status:429});
 try{const db=database();await runCampaignWorker(db);assert.equal(db.tables.sv_campaign_items[0].status,'failed');assert.match(db.tables.sv_content_campaigns[0].last_error,/quota/);assert.equal(JSON.stringify(db.tables).includes('private billing'),false);assert.equal(db.calls.some(call=>call.name==='sv_finish_campaign_item'),false);}
 finally{globalThis.fetch=original;}
});
test('retrying saved content uses its original lease and avoids another AI charge',async()=>{
 const db=database({cached:true});const result=await runCampaignWorker(db);
 assert.equal(result.postId,'post');assert.equal(db.calls.some(call=>call.name==='sv_reserve_ai_request'),false);assert.deepEqual(db.calls.find(call=>call.name==='sv_finish_campaign_item').args,{item_id:'item',lease:'lease'});
});
