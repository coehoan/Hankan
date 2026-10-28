import {z} from 'zod';
import {assertSameOrigin,requireFridgeAccess} from '@/lib/auth';
import {AppError,errorResponse} from '@/lib/errors';
import {parseId} from '@/features/inventory/domain';
import {readInventoryJson} from '@/features/inventory/http';
import {recommendForFridgeSnapshot} from '@/features/recipes/service';
export async function POST(request:Request,{params}:{params:Promise<{fridgeId:string}>}){
 try{
  assertSameOrigin(request);if(!z.object({}).strict().safeParse(await readInventoryJson(request)).success)throw new AppError('validation','추천 요청을 확인해 주세요.');
  const access=await requireFridgeAccess(parseId((await params).fridgeId));const result=await recommendForFridgeSnapshot(access);
  return Response.json({data:result.matches,inventoryVersion:result.inventoryVersion,today:result.today},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return errorResponse(error)}
}
