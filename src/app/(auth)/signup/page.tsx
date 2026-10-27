import { AuthFrame } from '@/features/auth/auth-frame';
import { AuthForm } from '@/features/auth/auth-form';

export const metadata={title:'회원가입'};
export default async function SignupPage({searchParams}:{searchParams:Promise<{next?:string}>}){
 const params=await searchParams;
 return <AuthFrame><AuthForm mode="sign-up" nextPath={params.next}/></AuthFrame>;
}
