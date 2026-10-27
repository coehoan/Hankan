import 'server-only';
import type { AccessContext, MemberRole } from './contracts';
import { AppError } from './errors';
import { siteOrigin } from './env';
import { createServerSupabaseClient } from './supabase/server';

export async function requireUser():Promise<{userId:string}>{
 const client=await createServerSupabaseClient();
 const {data,error}=await client.auth.getClaims();
 if(error||!data?.claims?.sub||data.claims.role!=='authenticated')throw new AppError('unauthenticated','로그인이 필요해요.');
 return {userId:data.claims.sub};
}

export async function requireFridgeAccess(fridgeId:string,minimumRole:MemberRole='member'):Promise<AccessContext>{
 const {userId}=await requireUser();
 const client=await createServerSupabaseClient();
 const {data,error}=await client.from('fridge_members').select('role').eq('fridge_id',fridgeId).eq('user_id',userId).maybeSingle();
 if(error)throw new AppError('internal','냉장고 접근 권한을 확인할 수 없어요.');
 if(!data||(data.role!=='owner'&&data.role!=='member')||(minimumRole==='owner'&&data.role!=='owner'))throw new AppError('forbidden','이 냉장고에 접근할 권한이 없어요.');
 return {userId,fridgeId,role:data.role};
}

export function assertSameOrigin(request:Request):void{
 if(request.headers.get('origin')!==siteOrigin())throw new AppError('forbidden','허용되지 않은 요청이에요.');
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new AppError('validation','올바른 형식으로 다시 요청해 주세요.');
}
