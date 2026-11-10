import 'server-only';
import { z } from 'zod';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type { PushSubscriptionRecord, PushTransport } from '@/features/notifications/types';
import { createWebPushTransport } from '@/features/notifications/web-push-transport';
type Job = { id: string; userId: string; token: string; status: string };
type Outbox = {
  prepare: (job: Job) => Promise<PushSubscriptionRecord[] | null>;
  record: (job: Job, id: string, result: 'sent' | 'gone') => Promise<void>;
  finish: (job: Job, retry: boolean) => Promise<void>;
};
export async function dispatchRecipeNotification(
  job: Job,
  transport: PushTransport,
  outbox: Outbox,
): Promise<void> {
  const initial = await outbox.prepare(job);
  if (!initial) return;
  let retry = initial.length > 5;
  for (const sub of initial.slice(0, 5)) {
    const fresh = await outbox.prepare(job);
    if (!fresh) return;
    const current = fresh.find((value) => value.id === sub.id);
    if (!current) continue;
    const result = await transport.send(current, {
      notificationId: job.userId + ':recipe:' + job.id,
      recipeJobId: job.id,
      title: '요리 추천 완료',
      body:
        job.status === 'failed'
          ? '추천을 완료하지 못했어요. 내역에서 다시 확인해 주세요.'
          : '요리 추천 결과가 준비됐어요. 저장된 요리를 확인해 보세요.',
      url: '/recipes/jobs/' + job.id,
    });
    if (result === 'retry') retry = true;
    else await outbox.record(job, current.id, result);
  }
  await outbox.finish(job, retry);
}
const subscriptions = z.array(
  z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    endpoint: z.string(),
    p256dh: z.string(),
    auth: z.string(),
  }),
);
export async function processRecipeNotifications(): Promise<void> {
  const transport = createWebPushTransport();
  if (!transport) return;
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc('claim_recipe_notifications');
  if (error) throw new Error('Cannot claim recipe notifications');
  const outbox: Outbox = {
    async prepare(job) {
      const result = await admin.rpc('prepare_recipe_notification', {
        job_id: job.id,
        token: job.token,
      });
      if (result.error) throw new Error('Cannot prepare recipe notification');
      if (result.data === null) return null;
      const parsed = subscriptions.safeParse(result.data);
      if (!parsed.success) throw new Error('Cannot read recipe subscriptions');
      return parsed.data.map((sub) => ({
        id: sub.id,
        userId: sub.user_id,
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
      }));
    },
    async record(job, id, result) {
      if (result === 'gone') {
        const removed = await admin
          .from('push_subscriptions')
          .delete()
          .eq('id', id)
          .eq('user_id', job.userId);
        if (removed.error) throw new Error('Cannot retire recipe subscription');
      }
      const recorded = await admin.rpc('record_recipe_notification', {
        job_id: job.id,
        token: job.token,
        subscription_id: id,
      });
      if (recorded.error) throw new Error('Cannot record recipe delivery');
    },
    async finish(job, retry) {
      const result = await admin
        .from('recipe_jobs')
        .update(
          retry
            ? { notify_token: null, notify_until: new Date(Date.now() + 60000).toISOString() }
            : { notified_at: new Date().toISOString(), notify_token: null, notify_until: null },
        )
        .eq('id', job.id)
        .eq('notify_token', job.token)
        .gt('notify_until', new Date().toISOString());
      if (result.error) throw new Error('Cannot finish recipe notification');
    },
  };
  const results = await Promise.allSettled(
    (data ?? []).map((job) =>
      dispatchRecipeNotification(
        { id: job.id, userId: job.user_id, token: job.notify_token!, status: job.status },
        transport,
        outbox,
      ),
    ),
  );
  if (results.some((result) => result.status === 'rejected'))
    throw new Error('Recipe notification deferred');
}
