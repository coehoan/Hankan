import 'server-only';
import { requireFridgeAccess,requireUser } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { parseId } from '@/features/inventory/domain';
import type { FridgeDirectory } from './contracts';
export async function loadFridgeDirectory():Promise<FridgeDirectory>{
 const {userId}=await requireUser(),client=await createServerSupabaseClient();
 const [fridges,memberships,profile]=await Promise.all([
  client.from('fridges').select('id,name').order('created_at'),
  client.from('fridge_members').select('fridge_id,role').eq('user_id',userId),
  client.from('profiles').select('last_fridge_id,timezone').eq('user_id',userId).single(),
 ]);
 if(fridges.error||memberships.error||profile.error)throw new AppError('internal','냉장고 목록을 불러오지 못했어요. 다시 시도해 주세요.');
 const available=(fridges.data??[]).flatMap(fridge=>{const membership=memberships.data?.find(member=>member.fridge_id===fridge.id);return membership?[{...fridge,role:membership.role}]:[]}).sort((a,b)=>Number(b.role==='owner')-Number(a.role==='owner'));
 const owned=available.find(fridge=>fridge.role==='owner');
 if(!owned)throw new AppError('internal','본인 냉장고를 확인하지 못했어요.');
 const selectedId=available.some(fridge=>fridge.id===profile.data.last_fridge_id)?profile.data.last_fridge_id!:owned.id;
 return {fridges:available,selectedId,timeZone:profile.data.timezone};
}
export async function selectFridge(id:string):Promise<void>{
 const access=await requireFridgeAccess(parseId(id)),client=await createServerSupabaseClient();
 const result=await client.from('profiles').update({last_fridge_id:id}).eq('user_id',access.userId).select('user_id').single();
 if(result.error?.code==='42501')throw new AppError('forbidden','냉장고 접근 권한이 변경됐어요.');
 if(result.error)throw new AppError('internal','냉장고 선택을 저장하지 못했어요. 다시 시도해 주세요.');
}
