import type { DigestJob, Outbox, PushTransport } from './types';
import { databaseOutbox } from './outbox';
export async function dispatchDigest(
  job: DigestJob,
  transport: PushTransport,
  outbox: Outbox = databaseOutbox,
): Promise<void> {
  const initial = await outbox.prepare(job);
  let retry = false;
  for (const subscription of initial?.subscriptions ?? []) {
    const current = await outbox.prepare(job);
    if (!current) break;
    if (!current.subscriptions.some((s) => s.id === subscription.id)) continue;
    const count = current.digest.groups.reduce((sum, g) => sum + g.ingredients.length, 0);
    if (!count) break;
    let result: 'sent' | 'gone' | 'retry';
    try {
      result = await transport.send(subscription, {
        notificationId: job.userId + ':' + job.localDate,
        digestId: job.id,
        title: '한칸 · 임박 재료 알림',
        body: count + '개 재료를 먼저 사용해 보세요.',
        url: '/notifications/' + job.id,
      });
    } catch {
      result = 'retry';
    }
    if (result === 'retry') retry = true;
    else await outbox.record(job, subscription.id, result);
  }
  await outbox.finish(job, retry);
}
