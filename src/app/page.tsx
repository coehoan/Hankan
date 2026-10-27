import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { loadFridgeDirectory } from '@/features/shell/service';

export const dynamic='force-dynamic';
export default async function HomePage(){
 try{await requireUser()}catch(error){if(error instanceof AppError&&error.code==='unauthenticated')redirect('/login');throw error}
 const directory=await loadFridgeDirectory();redirect('/fridges/'+directory.selectedId);
}
