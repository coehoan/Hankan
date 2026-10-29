import nextEnv from '@next/env';
import {createAdminSupabaseClient} from '@/lib/supabase/admin';
import {claimDueDigests,databaseOutbox} from '@/features/notifications/outbox';
import {dispatchDigest} from '@/features/notifications/dispatcher';
import {createWebPushTransport} from '@/features/notifications/web-push-transport';
import {cleanReceipts} from './cleanup';
import {cleanupStagedUploads} from './staging-cleanup';

export async function cleanupReceiptFiles(now:string):Promise<{deleted:number;failed:number}>{
 const admin=createAdminSupabaseClient();
 return cleanReceipts(now,{
  async expire(){const {error}=await admin.rpc('expire_receipts');if(error)throw new Error('Cannot expire receipts')},
  async pending(){const {data,error}=await admin.from('receipt_drafts').select('id,object_path').eq('cleanup_pending',true).limit(100);if(error)throw new Error('Cannot list cleanup');return (data??[]).map(r=>({id:r.id,path:r.object_path}))},
  async remove(path){const {error}=await admin.storage.from('receipt-originals').remove([path]);if(error)throw new Error('Cannot remove receipt file')},
  async complete(id){const {error}=await admin.from('receipt_drafts').update({cleanup_pending:false}).eq('id',id);if(error)throw new Error('Cannot record cleanup')},
 });
}
let running=false;
export async function runCycle():Promise<void>{
 if(running)return;running=true;
 try{
  const transport=createWebPushTransport();
  if(transport){for(const job of await claimDueDigests(new Date().toISOString(),20))try{await dispatchDigest(job,transport,databaseOutbox)}catch{console.error('Notification job deferred; lease will recover')}}
  else console.info('Push unconfigured; cleanup remains active');
  const result=await cleanupReceiptFiles(new Date().toISOString());console.info('Receipt cleanup',result);
  const staged=await cleanupStagedUploads(new Date().toISOString());console.info('Staged receipt cleanup',staged);
 }finally{running=false}
}
async function main(){
 nextEnv.loadEnvConfig(process.cwd());
 const once=process.argv.includes('--once');
 const tick=()=>runCycle().catch(()=>{console.error('Worker cycle failed');if(once)process.exitCode=1});
 await tick();if(!once)setInterval(()=>void tick(),60000);
}
if(process.env.HANKAN_WORKER_MAIN==='1')void main();
