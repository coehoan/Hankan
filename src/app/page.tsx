import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic='force-dynamic';
export default async function HomePage(){
 let userId:string;
 try{({userId}=await requireUser())}catch(error){if(error instanceof AppError&&error.code==='unauthenticated')redirect('/login');throw error}
 const client=await createServerSupabaseClient();
 const {data,error}=await client.from('fridges').select('id').eq('owner_user_id',userId).single();
 if(error||!data)throw new AppError('internal','냉장고를 불러오지 못했어요. 다시 시도해 주세요.');
 redirect('/fridges/'+data.id);
}
