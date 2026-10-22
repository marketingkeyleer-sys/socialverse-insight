import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publishingAccessIssue} from '../supabase/functions/_shared/publishing-access.ts';
let handler, authenticated=true, used=1;
const env=new Map(Object.entries({OPENAI_API_KEY:'test',SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'}));
globalThis.Deno={env:{get:key=>env.get(key)},serve:fn=>{handler=fn;}};
globalThis.testCreateClient=()=>({auth:{getUser:async()=>({data:{user:authenticated?{id:'owner'}:null}})},rpc:async()=>({data:used,error:null})});
await import('../supabase/functions/generate-post/index.ts');
const request=body=>new Request('https://edge.example.com',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify(body)});
test('AI checks authentication and quota before calling its provider',async()=>{
 const original=globalThis.fetch; let calls=0;
 globalThis.fetch=async()=>{calls++;throw new Error('unexpected');};
 try {
 authenticated=false;assert.equal((await handler(request({title:'Topic',withImage:false}))).status,401);
 authenticated=true;used=-1;assert.equal((await handler(request({title:'Topic',withImage:false}))).status,429);
 assert.equal(calls,0);
 }finally{globalThis.fetch=original;used=1;authenticated=true;}
});
test('caption-only generation skips image requests and image failure preserves a usable caption',async()=>{
 const original=globalThis.fetch;const paths=[];
 globalThis.fetch=async address=>{paths.push(address);return address.endsWith('completions')?Response.json({choices:[{message:{content:'A useful caption'}}]}):Response.json({error:{message:'private provider detail'}},{status:500});};
 try {
 const caption=await (await handler(request({title:'Topic',withImage:false}))).json();
 assert.equal(caption.caption,'A useful caption');assert.equal(paths.length,1);
 const partial=await (await handler(request({title:'Topic',withImage:true}))).json();
 assert.equal(partial.caption,'A useful caption');assert.match(partial.warning,/image service/);assert.equal(JSON.stringify(partial).includes('private provider detail'),false);
 }finally{globalThis.fetch=original;}
});
test('publishing preflight distinguishes read-only connections and managed LinkedIn Pages',()=>{
 assert.match(publishingAccessIssue({platform:'instagram',scopes:['instagram_basic']}),/permission is missing/);
 assert.equal(publishingAccessIssue({platform:'instagram',scopes:['instagram_content_publish']}),null);
 assert.equal(publishingAccessIssue({platform:'linkedin_page',scopes:['socialverse:upload-post']}),null);
 assert.match(publishingAccessIssue({platform:'facebook',is_active:false}),/Reconnect/);
});
