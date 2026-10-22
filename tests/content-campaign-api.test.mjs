import {test} from 'node:test';
import assert from 'node:assert/strict';
let handler,owner='owner',tables={},calls=[];
globalThis.Deno={env:{get:key=>({SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',OPENAI_API_KEY:'test'})[key]},serve:fn=>{handler=fn;}};
globalThis.testCreateClient=()=>({auth:{getUser:async()=>({data:{user:owner?{id:owner}:null}})},async rpc(name,args){calls.push({name,args});return {data:'new-plan',error:null};},from(table){const filters=[];const query={select(){return query;},order(){return query;},range(){return query;},eq(key,value){filters.push(row=>row[key]===value);return query;},in(key,values){filters.push(row=>values.includes(row[key]));return query;},maybeSingle:async()=>({data:(tables[table]??[]).find(row=>filters.every(filter=>filter(row)))}),then(resolve,reject){const rows=(tables[table]??[]).filter(row=>filters.every(filter=>filter(row)));return Promise.resolve({data:rows,count:rows.length,error:null}).then(resolve,reject);}};return query;}});
await import('../supabase/functions/content-campaigns/index.ts');
const request=body=>new Request('https://edge.example.com',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify(body)});
function setup(){owner='owner';calls=[];tables={sv_brands:[{id:'brand',user_id:'owner'}],sv_connected_accounts:[{id:'account',brand_id:'brand',user_id:'owner',platform:'linkedin_page',is_active:true,scopes:['w_organization_social']}],sv_content_campaigns:[{id:'plan',brand_id:'brand',user_id:'owner',status:'paused'}]};}
function payload(){const day=new Date(Date.now()+2*86400000).toISOString().slice(0,10);return {action:'create',brandId:'brand',name:'Company education',brief:'A robotics company sharing useful industrial automation education.',withImages:false,autoPublish:false,dailyLimit:6,accountIds:['account'],requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',schedule:{startDate:day,months:1,weekdays:[0,1,2,3,4,5,6],time:'10:00',timezone:'Asia/Kolkata'}};}
test('planner management authenticates users and rejects foreign brands before writes',async()=>{
 setup();owner=null;assert.equal((await handler(request(payload()))).status,401);assert.equal(calls.length,0);
 setup();const result=await handler(request({...payload(),brandId:'foreign'}));assert.equal(result.status,400);assert.match((await result.json()).error,/owned company/);assert.equal(calls.length,0);
});
test('a foreign account or unsupported video destination cannot enter an image/caption campaign',async()=>{
 setup();tables.sv_connected_accounts[0].brand_id='foreign';assert.equal((await handler(request(payload()))).status,400);assert.equal(calls.length,0);
 setup();tables.sv_connected_accounts[0].platform='youtube';tables.sv_connected_accounts[0].scopes=['https://www.googleapis.com/auth/youtube.upload'];const response=await handler(request(payload()));assert.match((await response.json()).error,/real video/);assert.equal(calls.length,0);
});
test('creating an owned plan forwards validated slots and an idempotency key without activating generation',async()=>{
 setup();const response=await handler(request(payload()));assert.equal(response.status,200);
 assert.equal(calls.length,1);assert.equal(calls[0].name,'sv_create_campaign');assert.equal(calls[0].args.owner_id,'owner');assert.equal(calls[0].args.automatic,false);assert.equal(calls[0].args.request_key_in,payload().requestId);assert.ok(calls[0].args.slots.length>=28);assert.equal(tables.sv_content_campaigns[0].status,'paused');
});
test('activation requires explicit consent and cannot reopen an ended plan',async()=>{
 setup();const result=await handler(request({action:'activate',brandId:'brand',planId:'plan'}));assert.match((await result.json()).error,/Confirm AI usage/);
 setup();tables.sv_content_campaigns[0].status='completed';const ended=await handler(request({action:'activate',brandId:'brand',planId:'plan',confirm:true}));assert.match((await ended.json()).error,/paused plan/);assert.equal(calls.length,0);
});
test('slot monitoring shows the owned post status and never exposes a foreign post status',async()=>{
 setup();tables.sv_campaign_items=[{id:'one',user_id:'owner',campaign_id:'plan',post_id:'owned'},{id:'two',user_id:'owner',campaign_id:'plan',post_id:'foreign'},{id:'private',user_id:'another-owner',campaign_id:'plan',post_id:'foreign'}];
 tables.sv_posts=[{id:'owned',user_id:'owner',status:'published'},{id:'foreign',user_id:'another-owner',status:'private-status'}];
 const response=await handler(request({action:'list',brandId:'brand'}));assert.equal(response.status,200);const body=await response.json();
 assert.equal(body.items.length,2);assert.equal(body.items[0].post_status,'published');assert.equal(body.items[1].post_status,null);assert.equal(JSON.stringify(body).includes('private-status'),false);
});
