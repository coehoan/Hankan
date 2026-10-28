import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { parseAuthInput } from './validation';
import {deleteBrowserSubscription} from '@/features/notifications/subscriptions';
import {usernameToEmail} from './identity';

export async function signUp(username:string,password:string):Promise<void>{
 const input=parseAuthInput('sign-up',{username,password});
 if(input.action!=='sign-up')return;
 const client=await createServerSupabaseClient();
 const {data,error}=await client.auth.signUp({email:usernameToEmail(input.username),password:input.password,options:{data:{display_name:input.username}}});
 if(error?.code==='user_already_exists')throw new AppError('conflict','이미 사용 중인 아이디예요. 다른 아이디를 입력해 주세요.');
 if(error)throw new AppError('validation','가입을 완료하지 못했어요. 아이디와 비밀번호를 확인해 주세요.');
 if(!data.session)throw new AppError('internal','즉시 가입 설정을 확인해야 해요. 관리자에게 문의해 주세요.');
}

export async function signIn(username:string,password:string):Promise<void>{
 const input=parseAuthInput('sign-in',{username,password});
 if(input.action!=='sign-in')return;
 const client=await createServerSupabaseClient();
 const {error}=await client.auth.signInWithPassword({email:usernameToEmail(input.username),password:input.password});
 if(error)throw new AppError('unauthenticated','아이디와 비밀번호를 확인해 주세요.');
}

export async function updatePassword(password:string,confirmPassword:string):Promise<void>{
 const input=parseAuthInput('update-password',{password,confirmPassword});
 if(input.action!=='update-password')return;
 await requireUser();
 const client=await createServerSupabaseClient();
 const {error}=await client.auth.updateUser({password:input.password});
 if(error)throw new AppError('validation','새 비밀번호로 변경하지 못했어요. 다른 비밀번호를 입력해 주세요.');
}

export async function signOut():Promise<void>{
 await deleteBrowserSubscription();
 const client=await createServerSupabaseClient();
 const {error}=await client.auth.signOut({scope:'local'});
 if(error)throw new AppError('internal','로그아웃하지 못했어요. 다시 시도해 주세요.');
}
