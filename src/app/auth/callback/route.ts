import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/features/auth/redirects';
import { siteOrigin } from '@/lib/env';

export async function GET(request:Request){
 const url=new URL(request.url);
 const code=url.searchParams.get('code');
 if(code){
  const client=await createServerSupabaseClient();
  const {error}=await client.auth.exchangeCodeForSession(code);
  if(!error)return NextResponse.redirect(new URL(safeNextPath(url.searchParams.get('next')),siteOrigin()));
 }
 return NextResponse.redirect(new URL('/login?notice=link-expired',siteOrigin()));
}
