import {NextResponse} from 'next/server';
import {z} from 'zod';
import {assertSameOrigin,requireUser} from '@/lib/auth';
import {AppError,errorResponse} from '@/lib/errors';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {readInventoryJson} from '@/features/inventory/http';
export async function PATCH(request:Request){
 try{
  assertSameOrigin(request);const {userId}=await requireUser();
  const input=z.object({preference:z.enum(['system','light','dark'])}).strict().safeParse(await readInventoryJson(request));
  if(!input.success)throw new AppError('validation','화면 테마를 확인해 주세요.');
  const client=await createServerSupabaseClient();
  const result=await client.from('profiles').update({theme_preference:input.data.preference}).eq('user_id',userId).select('user_id').single();
  if(result.error)throw new AppError('internal','화면 테마를 저장하지 못했어요. 다시 시도해 주세요.');
  const response=NextResponse.json({data:input.data},{headers:{'Cache-Control':'private, no-store'}});
  response.cookies.set('hankan-theme',input.data.preference,{path:'/',maxAge:31536000,sameSite:'lax',secure:new URL(request.url).protocol==='https:'});return response;
 }catch(error){return errorResponse(error)}
}
