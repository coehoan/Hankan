import { expect, it, vi } from 'vitest';
import type { PushSubscriptionRecord } from '@/features/notifications/types';
import { dispatchRecipeNotification } from './job-notifications';
const job = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: 'user',
  token: 'token',
  status: 'complete',
};
const sub: PushSubscriptionRecord = {
  id: 'sub',
  userId: 'user',
  endpoint: 'https://fcm.googleapis.com/x',
  p256dh: 'key',
  auth: 'auth',
};
it('rechecks_opt_in_before_each_send_and_uses_saved_result_url', async () => {
  const prepare = vi
    .fn()
    .mockResolvedValueOnce([sub, { ...sub, id: 'second' }])
    .mockResolvedValueOnce([sub])
    .mockResolvedValueOnce(null);
  const record = vi.fn(),
    finish = vi.fn(),
    send = vi.fn().mockResolvedValue('sent');
  await dispatchRecipeNotification(job, { send }, { prepare, record, finish });
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][1]).toMatchObject({
    recipeJobId: job.id,
    url: '/recipes/jobs/' + job.id,
    notificationId: 'user:recipe:' + job.id,
  });
  expect(record).toHaveBeenCalledWith(job, 'sub', 'sent');
});
it('retries_delivery_without_losing_results_and_skips_disabled_users', async () => {
  const record = vi.fn(),
    finish = vi.fn(),
    send = vi.fn().mockResolvedValue('retry');
  await dispatchRecipeNotification(job, { send }, { prepare: async () => [sub], record, finish });
  expect(finish).toHaveBeenCalledWith(job, true);
  expect(record).not.toHaveBeenCalled();
  send.mockClear();
  await dispatchRecipeNotification(job, { send }, { prepare: async () => null, record, finish });
  expect(send).not.toHaveBeenCalled();
});
