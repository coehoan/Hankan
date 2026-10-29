import 'server-only';
import {createAdminSupabaseClient} from '@/lib/supabase/admin';
export function expiredStagedPaths(objects:{name:string;created_at?:string|null}[],now:string):string[]{
 const cutoff=Date.parse(now)-125*60_000;
 return objects.filter(object=>object.created_at&&Date.parse(object.created_at)<cutoff).map(object=>object.name);
}
export async function cleanupStagedUploads(now:string){
 const storage=createAdminSupabaseClient().storage.from('receipt-uploads');
 const {data,error}=await storage.list('',{limit:100,sortBy:{column:'created_at',order:'asc'}});
 if(error)throw new Error('Cannot list staged uploads');
 const paths=expiredStagedPaths(data??[],now);if(!paths.length)return {deleted:0,failed:0};
 const removed=await storage.remove(paths);return {deleted:removed.error?0:paths.length,failed:removed.error?paths.length:0};
}
