import { AuthFrame } from '@/features/auth/auth-frame';
import { AuthForm } from '@/features/auth/auth-form';

export const metadata={title:'비밀번호 재설정'};
export default async function ResetPage({searchParams}:{searchParams:Promise<{mode?:string}>}){
 const params=await searchParams;
 return <AuthFrame><AuthForm mode={params.mode==='update'?'update-password':'request-reset'}/></AuthFrame>;
}
