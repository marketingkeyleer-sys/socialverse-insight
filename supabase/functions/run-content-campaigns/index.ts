import {createClient} from 'npm:@supabase/supabase-js@2';
import {runCampaignWorker} from '../_shared/campaign-worker.ts';
Deno.serve(async request=>{
 const secret=Deno.env.get('CRON_SECRET');
 if(request.method!=='POST'||!secret||request.headers.get('Authorization')!==`Bearer ${secret}`) return new Response('Unauthorized',{status:401});
 try{
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 return Response.json(await runCampaignWorker(admin));
 }catch{return Response.json({error:'Planner worker could not run. Check database setup.'},{status:500});}
});
