import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicSupabaseConfig } from '@/lib/env';
import type { Database } from './database.types';

export async function createServerSupabaseClient(){
 const jar=await cookies();
 const {url,key}=publicSupabaseConfig();
 return createServerClient<Database>(url,key,{
  cookies:{
   getAll:()=>jar.getAll(),
   setAll:values=>{
    try{for(const {name,value,options} of values)jar.set(name,value,options)}
    catch{/* Read-only Server Components rely on the proxy to refresh cookies. */}
   },
  },
 });
}
