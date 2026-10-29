import { AuthFrame } from '@/features/auth/auth-frame';
import { AuthForm } from '@/features/auth/auth-form';

export const metadata = { title: '로그인' };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; notice?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthFrame>
      <AuthForm mode="sign-in" nextPath={params.next} notice={params.notice} />
    </AuthFrame>
  );
}
