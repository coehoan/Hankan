import 'server-only';
import type { AccessContext } from '@/lib/contracts';
import { requireFridgeAccess } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/supabase/database.types';
import type { CreateIngredientInput,Ingredient,IngredientPatch } from './contracts';
import { parseCreateIngredient,parseId,parseIngredientPatch,parseVersion } from './domain';

async function authorizedClient(access:AccessContext) {
  const current = await requireFridgeAccess(parseId(access.fridgeId));
  if (current.userId !== access.userId) throw new AppError('forbidden','냉장고 접근 권한을 다시 확인해 주세요.');
  return createServerSupabaseClient();
}

function checkDatabaseError(error:{code?:string}|null):void {
  if (!error) return;
  if (error.code==='42501') throw new AppError('forbidden','이 냉장고에 접근할 권한이 없어요.');
  if (error.code==='P0002') throw new AppError('not_found','이미 삭제되었거나 찾을 수 없는 재료예요.');
  if (['PT409','40001','40P01'].includes(error.code??'')) throw new AppError('conflict','다른 변경이 먼저 저장됐어요. 최신 내용을 확인하고 다시 시도해 주세요.');
  if (error.code?.startsWith('22') || ['23514','23502'].includes(error.code??'')) throw new AppError('validation','재료 입력 내용을 확인해 주세요.');
  throw new AppError('internal','재료를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
}

function toIngredient(row:Tables<'ingredients'>):Ingredient {
  const place = row.storage;
  if ((place!=='fridge' && place!=='freezer' && place!=='pantry') || row.normalized_name===null) throw new AppError('internal','재료 정보를 읽지 못했어요.');
  return {
    id:row.id,fridgeId:row.fridge_id,name:row.name,normalizedName:row.normalized_name,
    storage:place,expiresOn:row.expires_on,remainingPercent:row.remaining_percent,version:row.version,
    createdAt:row.created_at,updatedAt:row.updated_at,createdBy:row.created_by,updatedBy:row.updated_by,
  };
}

export async function createIngredient(access:AccessContext,input:CreateIngredientInput):Promise<Ingredient> {
  const client = await authorizedClient(access);
  const value = parseCreateIngredient(input);
  const result = await client.rpc('create_ingredient',{target_fridge_id:access.fridgeId,input:{...value}});
  checkDatabaseError(result.error);
  if (!result.data) throw new AppError('internal','저장 결과를 확인하지 못했어요.');
  return toIngredient(result.data);
}

export async function listIngredients(access:AccessContext):Promise<Ingredient[]> {
  const client = await authorizedClient(access);
  const result = await client.from('ingredients').select('*').eq('fridge_id',access.fridgeId).order('expires_on').order('created_at').order('id');
  checkDatabaseError(result.error);
  return (result.data??[]).map(toIngredient);
}

export async function updateIngredient(access:AccessContext,id:string,expectedVersion:number,patch:IngredientPatch):Promise<Ingredient> {
  const client = await authorizedClient(access);
  const value = parseIngredientPatch(patch);
  const result = await client.rpc('update_ingredient',{target_fridge_id:access.fridgeId,ingredient_id:parseId(id),expected_version:parseVersion(expectedVersion),patch:{...value}});
  checkDatabaseError(result.error);
  if (!result.data) throw new AppError('internal','저장 결과를 확인하지 못했어요.');
  return toIngredient(result.data);
}

export async function deleteIngredient(access:AccessContext,id:string,expectedVersion:number):Promise<void> {
  const client = await authorizedClient(access);
  const result = await client.rpc('delete_ingredient',{target_fridge_id:access.fridgeId,ingredient_id:parseId(id),expected_version:parseVersion(expectedVersion)});
  checkDatabaseError(result.error);
}
