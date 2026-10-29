import 'server-only';
import { requireUser } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { preferenceInput, type NotificationPreferences } from './contracts';
export type { NotificationPreferences } from './contracts';
function toPreferences(row: {
  enabled: boolean;
  local_time: string;
  timezone: string;
  next_run_at: string | null;
}): NotificationPreferences {
  return {
    enabled: row.enabled,
    localTime: row.local_time,
    timezone: row.timezone,
    nextRunAt: row.next_run_at
      ? new Date(row.next_run_at).toISOString().replace('.000Z', 'Z')
      : null,
  };
}
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { userId } = await requireUser(),
    client = await createServerSupabaseClient();
  const result = await client
    .from('notification_preferences')
    .select('enabled,local_time,timezone,next_run_at')
    .eq('user_id', userId)
    .single();
  if (result.error || !result.data)
    throw new AppError('internal', '알림 설정을 불러오지 못했어요. 다시 시도해 주세요.');
  return toPreferences(result.data);
}
export async function saveNotificationPreferences(input: {
  enabled: boolean;
  localTime: string;
}): Promise<NotificationPreferences> {
  await requireUser();
  const parsed = preferenceInput.safeParse(input);
  if (!parsed.success)
    throw new AppError('validation', '알림 시각을 00:00부터 23:59 사이로 입력해 주세요.');
  const client = await createServerSupabaseClient(),
    result = await client.rpc('save_notification_preferences', { input: parsed.data });
  if (result.error?.code === '42501')
    throw new AppError('forbidden', '알림 설정 권한을 확인해 주세요.');
  if (result.error?.code.startsWith('22'))
    throw new AppError('validation', '알림 시각과 시간대를 확인해 주세요.');
  if (result.error || !result.data)
    throw new AppError('internal', '알림 설정을 저장하지 못했어요. 이전 설정은 유지돼요.');
  return toPreferences(result.data);
}
