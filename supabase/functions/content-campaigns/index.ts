import {createClient} from 'npm:@supabase/supabase-js@2';
import {corsHeaders} from '../_shared/cors.ts';
import {campaignSlots,campaignAccountIssue} from '../_shared/campaign-policy.ts';
import {publishingAccessIssue} from '../_shared/publishing-access.ts';
import {validatePlatformDraft,platformPostContent} from '../_shared/content-policy.ts';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
Deno.serve(async request=>{
 if(request.method==='OPTIONS') return new Response(null,{headers:corsHeaders});
 if(request.method!=='POST') return json({error:'Use POST'},405);
 try {
  const url=Deno.env.get('SUPABASE_URL')!;
  const scoped=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:request.headers.get('Authorization')??''}}});
  const {data:auth,error:authError}=await scoped.auth.getUser();
  if(authError||!auth.user) return json({error:'Not authenticated'},401);
  const owner=auth.user.id;const body=await request.json();
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  if(typeof body.brandId!=='string') throw new Error('Choose one company brand');
  const {data:brand}=await admin.from('sv_brands').select('id').eq('id',body.brandId).eq('user_id',owner).maybeSingle();
  if(!brand) throw new Error('Choose an owned company brand');
  if(body.action==='list') {
   const {data:plans,error}=await admin.from('sv_content_campaigns').select('*').eq('user_id',owner).eq('brand_id',brand.id).order('created_at',{ascending:false});
   if(error) throw new Error('Content planner is not deployed yet. Ask your administrator to complete its database setup.');
   const selected=body.planId?(plans??[]).find((plan:any)=>plan.id===body.planId):plans?.[0];
   if(body.planId&&!selected) throw new Error('Choose a plan in this brand');
   const page=Number.isInteger(body.page)&&body.page>=0&&body.page<25?body.page:0;
   const {data:items,error:itemError,count}=selected?await admin.from('sv_campaign_items').select('*',{count:'exact'}).eq('user_id',owner).eq('campaign_id',selected.id).order('publish_at').order('id').range(page*100,page*100+99):{data:[],error:null,count:0};
   if(itemError) throw new Error('Planner slots could not load');
   const postIds=(items??[]).map((item:any)=>item.post_id).filter(Boolean);
   const {data:posts,error:postError}=postIds.length?await admin.from('sv_posts').select('id,status').eq('user_id',owner).in('id',postIds):{data:[],error:null};
   if(postError) throw new Error('Saved post statuses could not load');
   const statuses=new Map((posts??[]).map((post:any)=>[post.id,post.status]));
   return json({plans,items:(items??[]).map((item:any)=>({...item,post_status:statuses.get(item.post_id)??null})),total:count??0,selectedPlanId:selected?.id??null});
  }
  if(body.action==='create') {
   if(typeof body.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) throw new Error('Refresh the planner before saving');
   if(typeof body.name!=='string'||!body.name.trim()||body.name.length>120||typeof body.brief!=='string'||body.brief.trim().length<30||body.brief.length>4000) throw new Error('Add a plan name and company brief (30–4000 characters)');
   if(typeof body.withImages!=='boolean'||typeof body.autoPublish!=='boolean'||!Number.isInteger(body.dailyLimit)||body.dailyLimit<1||body.dailyLimit>20) throw new Error('Invalid generation settings');
   if(!Array.isArray(body.accountIds)||!body.accountIds.length||body.accountIds.length>50||new Set(body.accountIds).size!==body.accountIds.length) throw new Error('Select 1–50 different destinations');
   const {data:accounts,error}=await admin.from('sv_connected_accounts').select('*').eq('user_id',owner).eq('brand_id',brand.id).in('id',body.accountIds);
   if(error||accounts?.length!==body.accountIds.length) throw new Error('Destination does not belong to this brand');
   for(const account of accounts){const issue=publishingAccessIssue(account)||campaignAccountIssue(account,body.withImages);if(issue) throw new Error(issue);}
   const slots=campaignSlots(body.schedule);
   const {data:id,error:createError}=await admin.rpc('sv_create_campaign',{owner_id:owner,brand:brand.id,campaign_name:body.name.trim(),company_brief:body.brief.trim(),config:body.schedule,destinations:body.accountIds,images:body.withImages,automatic:body.autoPublish,daily_max:body.dailyLimit,slots,request_key_in:body.requestId});
   if(createError) throw new Error('Plan could not be saved. Check setup, plan capacity and destination access.');
   return json({id,slots:slots.length*accounts.length});
  }
  const {data:plan}=await admin.from('sv_content_campaigns').select('*').eq('id',body.planId).eq('user_id',owner).eq('brand_id',brand.id).maybeSingle();
  if(!plan) throw new Error('Plan is not available in this brand');
  if(body.action==='activate') {
   if(plan.status!=='paused') throw new Error('Only a paused plan can be activated');
   if(body.confirm!==true) throw new Error('Confirm AI usage and the publishing mode before activation');
   const {data:accounts,error}=await admin.from('sv_connected_accounts').select('*').eq('user_id',owner).eq('brand_id',brand.id).in('id',plan.account_ids);
   if(error||accounts?.length!==plan.account_ids.length) throw new Error('Some destinations are no longer available');
   for(const account of accounts){const issue=publishingAccessIssue(account)||campaignAccountIssue(account,plan.with_images);if(issue) throw new Error(issue);}
   if(!Deno.env.get('OPENAI_API_KEY')) throw new Error('AI server key is not configured');
   const {error:updateError}=await admin.from('sv_content_campaigns').update({status:'active',last_error:null}).eq('id',plan.id).eq('user_id',owner);
   if(updateError) throw new Error('Plan could not activate');
   return json({ok:true});
  }
  if(body.action==='pause'||body.action==='complete') {
   const {error}=await admin.from('sv_content_campaigns').update({status:body.action==='pause'?'paused':'completed'}).eq('id',plan.id).eq('user_id',owner);
   if(error) throw new Error('Plan status could not change');return json({ok:true});
  }
  const {data:item}=await admin.from('sv_campaign_items').select('*').eq('id',body.itemId).eq('campaign_id',plan.id).eq('user_id',owner).maybeSingle();
  if(!item) throw new Error('Slot is not available');
  if(body.action==='retry') {
   if(plan.status==='completed') throw new Error('Ended plans cannot generate more content');
   if(item.status!=='failed'||item.post_id||Date.parse(item.publish_at)<=Date.now()+3600000) throw new Error('Only failed, future slots without a saved post can retry');
   const {error}=await admin.from('sv_campaign_items').update({status:'pending',error_message:null,next_attempt_at:new Date().toISOString()}).eq('id',item.id).eq('user_id',owner).eq('status','failed');
   if(error) throw new Error('Slot could not retry');return json({ok:true});
  }
  if(body.action==='approve') {
   if(item.status!=='review'||!item.post_id||Date.parse(item.publish_at)<=Date.now()+60000) throw new Error('Review a future draft before scheduling');
   const {data:post}=await admin.from('sv_posts').select('*').eq('id',item.post_id).eq('user_id',owner).eq('brand_id',brand.id).single();
   const {data:account}=await admin.from('sv_connected_accounts').select('*').eq('id',item.account_id).eq('user_id',owner).eq('brand_id',brand.id).single();
   if(!post||!account||post.status!=='draft'||post.connected_account_ids?.length!==1||post.connected_account_ids[0]!==account.id) throw new Error('Draft destinations changed; schedule it in Compose instead');
   const issue=publishingAccessIssue(account)||campaignAccountIssue(account,plan.with_images);if(issue) throw new Error(issue);
   validatePlatformDraft(account.platform,platformPostContent(post,account.platform));
   const {data:saved,error}=await admin.from('sv_posts').update({status:'scheduled',scheduled_at:item.publish_at}).eq('id',post.id).eq('status','draft').eq('user_id',owner).select('id').maybeSingle();
   if(error||!saved) throw new Error('Draft could not be scheduled. Check your active scheduling limit.');
   await admin.from('sv_campaign_items').update({status:'scheduled'}).eq('id',item.id).eq('user_id',owner);
   return json({ok:true});
  }
  throw new Error('Unknown planner action');
 }catch(error){return json({error:error instanceof Error?error.message:'Content planner request failed'},400);}
});
