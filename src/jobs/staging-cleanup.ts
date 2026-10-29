import 'server-only';
import {createAdminSupabaseClient} from '@/lib/supabase/admin';
export function expiredStagedPaths(objects:{name:string;created_at?:string|null}[],now:string):string[]{
 const cutoff=Date.parse(now)-125*60_000;
 return objects.filter(object=>object.created_at&&Date.parse(object.created_at)<cutoff).map(object=>object.name);
}
export async function cleanupStagedUploads(now:string){
 const admin=createAdminSupabaseClient(),storage=admin.storage.from('receipt-uploads');
 const closed=await admin.from('receipt_drafts').select('id,staged_object_path,created_at').in('status',['saved','cancelled']).not('staged_object_path','is',null).order('created_at',{ascending:true}).limit(100);
 if(closed.error)throw new Error('Cannot list closed staged uploads');
 const {data,error}=await storage.list('',{limit:100,sortBy:{column:'created_at',order:'asc'}});
 if(error)throw new Error('Cannot list staged uploads');
 const paths=[...new Set([...expiredStagedPaths(data??[],now),...(closed.data??[]).flatMap(row=>row.staged_object_path?[row.staged_object_path]:[])])];if(!paths.length)return {deleted:0,failed:0};
 const removed=await storage.remove(paths);if(removed.error)return {deleted:0,failed:paths.length};
 const cutoff=Date.parse(now)-125*60_000;
 const retired=(closed.data??[]).filter(row=>Date.parse(row.created_at)<cutoff).map(row=>row.id);
 if(retired.length){const updated=await admin.from('receipt_drafts').update({staged_object_path:null}).in('id',retired).in('status',['saved','cancelled']);if(updated.error)throw new Error('Cannot retire staged upload links')}
 return {deleted:paths.length,failed:0};
}
