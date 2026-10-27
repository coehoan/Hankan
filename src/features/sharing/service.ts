import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import {requireFridgeAccess,requireUser} from '@/lib/auth';
import {AppError} from '@/lib/errors';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {parseId} from '@/features/inventory/domain';
import type { AccessContext } from '@/lib/contracts';
import type { FridgeSummary } from '@/features/shell/contracts';
import type {CreatedInvite,InviteInfo,InviteSummary,FridgeMember,InviteState} from './contracts';

export function validateInviteToken(token:string){if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new AppError('not_found','초대를 찾을 수 없어요.');return token}
const digest=(token:string)=>createHash('sha256').update(validateInviteToken(token)).digest('hex');
function check(error:{code?:string}|null){
 if(!error)return;
 if(error.code==='42501')throw new AppError('forbidden','이 동작을 할 수 있는 권한이 없어요.');
 if(error.code==='P0002')throw new AppError('not_found','초대 또는 멤버를 찾을 수 없어요.');
 if(error.code==='PT409')throw new AppError('conflict','이미 사용되었거나 만료·취소된 초대예요. 새 링크를 요청해 주세요.');
 if(error.code?.startsWith('22'))throw new AppError('validation','입력 내용을 확인해 주세요.');
 throw new AppError('internal','요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.');
}
async function checkedClient(access:AccessContext,owner=false){
 const verified=await requireFridgeAccess(parseId(access.fridgeId),owner?'owner':'member');
 if(verified.userId!==access.userId)throw new AppError('forbidden','접근 권한을 다시 확인해 주세요.');
 return createServerSupabaseClient();
}
export async function createInvite(access:AccessContext):Promise<CreatedInvite>{
 const client=await checkedClient(access,true),token=randomBytes(32).toString('base64url');
 const result=await client.rpc('create_fridge_invite',{target_fridge_id:access.fridgeId,token_digest:digest(token)}).single();check(result.error);
 if(!result.data)throw new AppError('internal','초대를 만들지 못했어요.');
 return {inviteId:result.data.invite_id,token,expiresAt:result.data.expires_at};
}
export async function revokeInvite(access:AccessContext,inviteId:string):Promise<void>{
 const client=await checkedClient(access,true);
 check((await client.rpc('revoke_fridge_invite',{target_fridge_id:access.fridgeId,invite_id:parseId(inviteId)})).error);
}
export async function inspectInvite(token:string):Promise<InviteInfo>{
 await requireUser();const client=await createServerSupabaseClient();
 const result=await client.rpc('inspect_fridge_invite',{token_digest:digest(token)}).single();check(result.error);
 if(!result.data||!['valid','expired','revoked','used','already_member'].includes(result.data.state))throw new AppError('internal','초대를 확인하지 못했어요.');
 return {fridgeId:result.data.fridge_id,fridgeName:result.data.fridge_name,role:'member',state:result.data.state as InviteState};
}
export async function acceptInvite(token:string):Promise<FridgeSummary>{
 await requireUser();const client=await createServerSupabaseClient();
 const result=await client.rpc('accept_fridge_invite',{token_digest:digest(token)}).single();check(result.error);
 if(!result.data)throw new AppError('internal','참여 결과를 확인하지 못했어요.');
 return {id:result.data.id,name:result.data.name,role:'member'};
}
export async function listMembers(access:AccessContext):Promise<FridgeMember[]>{
 const client=await checkedClient(access),result=await client.rpc('list_fridge_members',{target_fridge_id:access.fridgeId});check(result.error);
 return (result.data??[]).map(row=>({userId:row.user_id,displayName:row.display_name,role:row.role}));
}
export async function listInvites(access:AccessContext):Promise<InviteSummary[]>{
 const client=await checkedClient(access,true),result=await client.from('fridge_invites').select('id,expires_at,used_at,revoked_at').eq('fridge_id',access.fridgeId).order('created_at',{ascending:false});check(result.error);
 return (result.data??[]).map(row=>({id:row.id,expiresAt:row.expires_at,state:row.revoked_at?'revoked':row.used_at?'used':Date.parse(row.expires_at)<=Date.now()?'expired':'valid'}));
}
export async function removeMember(access:AccessContext,userId:string):Promise<void>{
 const client=await checkedClient(access,true);
 check((await client.rpc('remove_fridge_member',{target_fridge_id:access.fridgeId,member_user_id:parseId(userId)})).error);
}
export async function leaveFridge(access:AccessContext):Promise<void>{
 const client=await checkedClient(access);
 check((await client.rpc('leave_fridge',{target_fridge_id:access.fridgeId})).error);
}
