import {AuthFrame} from '@/features/auth/auth-frame';
import {AuthForm} from '@/features/auth/auth-form';
export const metadata={title:'비밀번호 변경'};
export default function ChangePasswordPage(){return <AuthFrame><AuthForm mode="update-password"/></AuthFrame>}
