import { AppError } from './errors';

export function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new AppError('internal', '서비스 연결 설정을 확인할 수 없어요.');
  return { url, key };
}

export function siteOrigin(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!value) throw new AppError('internal', '서비스 주소를 확인할 수 없어요.');
  try {
    return new URL(value).origin;
  } catch {
    throw new AppError('internal', '서비스 주소를 확인할 수 없어요.');
  }
}
