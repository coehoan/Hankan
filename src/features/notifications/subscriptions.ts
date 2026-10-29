import 'server-only';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors';
import { allowedPushEndpoint } from './web-push-transport';
import { siteOrigin } from '@/lib/env';
export const PUSH_COOKIE = 'hankan-push-id';
const inputSchema = z
  .object({
    endpoint: z.string().max(4096).refine(allowedPushEndpoint),
    expirationTime: z.number().nullable().optional(),
    keys: z
      .object({
        p256dh: z.string().regex(/^B[A-Za-z0-9_-]{86}=?$/),
        auth: z.string().regex(/^[A-Za-z0-9_-]{22}(==)?$/),
      })
      .strict(),
  })
  .strict();
export async function getPushConfiguration() {
  const { userId } = await requireUser(),
    client = await createServerSupabaseClient(),
    id = (await cookies()).get(PUSH_COOKIE)?.value;
  const { data, error } = id
    ? await client.from('push_subscriptions').select('id').eq('id', id).maybeSingle()
    : { data: null, error: null };
  if (error) throw new AppError('internal', '알림 연결 상태를 확인하지 못했어요.');
  return { userId, publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null, connected: !!data };
}
export async function registerSubscription(input: unknown) {
  await requireUser();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new AppError('validation', '브라우저 알림 정보를 확인해 주세요.');
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc('save_push_subscription', { input: parsed.data });
  if (error)
    throw new AppError(
      error.code === '23505' ? 'conflict' : 'validation',
      '알림 일정을 켠 뒤 브라우저 알림을 다시 연결해 주세요.',
    );
  const jar = await cookies();
  jar.set(PUSH_COOKIE, data, {
    httpOnly: true,
    sameSite: 'lax',
    secure: siteOrigin().startsWith('https:'),
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return { connected: true };
}
export async function deleteBrowserSubscription() {
  const jar = await cookies(),
    id = jar.get(PUSH_COOKIE)?.value;
  if (id) {
    const { error } = await (
      await createServerSupabaseClient()
    ).rpc('delete_push_subscription', { subscription_id: id });
    if (error) throw new AppError('internal', '알림 연결을 해제하지 못했어요. 다시 시도해 주세요.');
  }
  jar.delete(PUSH_COOKIE);
}
