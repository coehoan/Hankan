import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors';
import { siteOrigin } from '@/lib/env';
import { requireUser } from '@/lib/auth';
import { parseAuthInput } from './validation';
import { safeNextPath } from './redirects';

export async function signUp(email:string,password:string,nextPath='/'):Promise<void>{
 const input=parseAuthInput('sign-up',{email,password});
 if(input.action!=='sign-up')return;
 const client=await createServerSupabaseClient();
 const callback=new URL('/auth/callback',siteOrigin());
 callback.searchParams.set('next',safeNextPath(nextPath));
 const {error}=await client.auth.signUp({email:input.email,password:input.password,options:{emailRedirectTo:callback.toString()}});
 if(error)throw new AppError('validation','가입 요청을 완료하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.');
}

export async function signIn(email:string,password:string):Promise<void>{
 const input=parseAuthInput('sign-in',{email,password});
 if(input.action!=='sign-in')return;
 const client=await createServerSupabaseClient();
 const {error}=await client.auth.signInWithPassword({email:input.email,password:input.password});
 if(error)throw new AppError('unauthenticated','이메일과 비밀번호를 확인해 주세요. 가입 확인 메일도 확인해 주세요.');
}

export async function requestPasswordReset(email:string):Promise<void>{
 const input=parseAuthInput('request-reset',{email});
 if(input.action!=='request-reset')return;
 const callback=new URL('/auth/callback',siteOrigin());
 callback.searchParams.set('next','/reset-password?mode=update');
 const client=await createServerSupabaseClient();
 const {error}=await client.auth.resetPasswordForEmail(input.email,{redirectTo:callback.toString()});
 if(error)throw new AppError('internal','메일 요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.');
}

export async function updatePassword(password:string):Promise<void>{
 const input=parseAuthInput('update-password',{password});
 if(input.action!=='update-password')return;
 await requireUser();
 const client=await createServerSupabaseClient();
 const {error}=await client.auth.updateUser({password:input.password});
 if(error)throw new AppError('validation','새 비밀번호로 변경하지 못했어요. 다른 비밀번호를 입력해 주세요.');
}

export async function signOut():Promise<void>{
 const client=await createServerSupabaseClient();
 const {error}=await client.auth.signOut({scope:'local'});
 if(error)throw new AppError('internal','로그아웃하지 못했어요. 다시 시도해 주세요.');
}
