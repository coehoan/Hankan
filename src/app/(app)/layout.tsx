import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { AppError } from '@/lib/errors';

export const dynamic='force-dynamic';
export default async function ProtectedLayout({children}:{children:React.ReactNode}){
 try{await requireUser()}catch(error){if(error instanceof AppError&&error.code==='unauthenticated')redirect('/login');throw error}
 return children;
}
