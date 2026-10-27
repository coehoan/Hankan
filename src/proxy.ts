import { createServerClient } from '@supabase/ssr';
import { NextResponse,type NextRequest } from 'next/server';
import { publicSupabaseConfig } from '@/lib/env';
import type { Database } from '@/lib/supabase/database.types';

export async function proxy(request:NextRequest){
 let response=NextResponse.next({request});
 const {url,key}=publicSupabaseConfig();
 const client=createServerClient<Database>(url,key,{
  cookies:{
   getAll:()=>request.cookies.getAll(),
   setAll:values=>{
    for(const {name,value} of values)request.cookies.set(name,value);
    response=NextResponse.next({request});
    for(const {name,value,options} of values)response.cookies.set(name,value,options);
   },
  },
 });
 await client.auth.getClaims();
 response.headers.set('Cache-Control','private, no-store');
 return response;
}

export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']};
