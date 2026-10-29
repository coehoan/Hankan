import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { localAdmin, seedTestGroup, cleanupTestGroup, type GroupFixture } from '../support/db';
import { localDateAt } from '../../src/features/notifications/schedule';
import { claimDueDigests, databaseOutbox } from '../../src/features/notifications/outbox';
import { dispatchDigest } from '../../src/features/notifications/dispatcher';
import { vi } from 'vitest';
let group: GroupFixture;
const admin = localAdmin();
beforeAll(async () => {
  group = await seedTestGroup();
});
afterAll(async () => {
  if (group) await cleanupTestGroup(group);
});
async function due() {
  const enabled = await group.owner.client.rpc('save_notification_preferences', {
    input: { enabled: true, localTime: '23:59' },
  });
  expect(enabled.error).toBeNull();
  const { error } = await admin
    .from('notification_preferences')
    .update({ next_run_at: new Date(Date.now() - 1000).toISOString() })
    .eq('user_id', group.owner.userId);
  expect(error).toBeNull();
}
it('two_workers_claim_one_job_once', async () => {
  await due();
  const calls = await Promise.all([
    admin.rpc('claim_notification_jobs', { at_time: new Date().toISOString(), batch_limit: 100 }),
    admin.rpc('claim_notification_jobs', { at_time: new Date().toISOString(), batch_limit: 100 }),
  ]);
  calls.forEach((r) => expect(r.error).toBeNull());
  const jobs = calls.flatMap((r) => r.data ?? []).filter((j) => j.user_id === group.owner.userId);
  expect(jobs).toHaveLength(1);
});
it('worker_restart_reclaims_expired_lease_and_rejects_old_token', async () => {
  const { data: old, error } = await admin
    .from('notification_jobs')
    .select('*')
    .eq('user_id', group.owner.userId)
    .single();
  expect(error).toBeNull();
  await admin
    .from('notification_jobs')
    .update({ lease_until: new Date(Date.now() - 1000).toISOString() })
    .eq('id', old!.id);
  const next = await admin.rpc('claim_notification_jobs', {
    at_time: new Date().toISOString(),
    batch_limit: 100,
  });
  expect(next.error).toBeNull();
  const fresh = next.data!.find((j) => j.id === old!.id)!;
  expect(fresh.lease_token).not.toBe(old!.lease_token);
  const stale = await admin.rpc('prepare_notification_dispatch', {
    job_id: old!.id,
    token: old!.lease_token!,
  });
  expect(stale.data).toBeNull();
});
it('time_change_after_empty_digest_can_reschedule_today', async () => {
  const { data: job } = await admin
    .from('notification_jobs')
    .select('*')
    .eq('user_id', group.owner.userId)
    .single();
  const finished = await admin.rpc('finish_notification_job', {
    job_id: job!.id,
    token: job!.lease_token!,
    will_retry: false,
  });
  expect(finished.error).toBeNull();
  const saved = await group.owner.client.rpc('save_notification_preferences', {
    input: { enabled: true, localTime: '23:59' },
  });
  expect(saved.error).toBeNull();
  const { data } = await admin.from('notification_jobs').select('*').eq('id', job!.id).single();
  expect(data?.status).toBe('pending');
  expect(data?.due_at).toBe(saved.data!.next_run_at);
});
it('subscriptions_are_owned_and_private_jobs_are_not_client_readable', async () => {
  const input = {
    endpoint: 'https://fcm.googleapis.com/' + randomUUID(),
    keys: {
      p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64url'),
      auth: Buffer.alloc(16, 1).toString('base64url'),
    },
  };
  const saved = await group.owner.client.rpc('save_push_subscription', { input });
  expect(saved.error).toBeNull();
  expect((await group.outsider.client.from('push_subscriptions').select('id')).data).toEqual([]);
  expect((await group.outsider.client.from('notification_jobs').select('*')).error).not.toBeNull();
  expect(
    (
      await group.outsider.client.rpc('claim_notification_jobs', {
        at_time: new Date().toISOString(),
        batch_limit: 1,
      })
    ).error,
  ).not.toBeNull();
  expect(
    (await group.outsider.client.rpc('save_push_subscription', { input })).error,
  ).not.toBeNull();
  const disabled = await group.owner.client.rpc('save_notification_preferences', {
    input: { enabled: false, localTime: '23:59' },
  });
  expect(disabled.error).toBeNull();
  expect(
    (await admin.from('push_subscriptions').select('id').eq('user_id', group.owner.userId)).data,
  ).toEqual([]);
});
async function freshJob() {
  await admin.from('notification_jobs').delete().eq('user_id', group.owner.userId);
  await admin
    .from('notification_preferences')
    .update({ last_sent_local_date: null })
    .eq('user_id', group.owner.userId);
  await due();
  return (await claimDueDigests(new Date().toISOString(), 100)).find(
    (j) => j.userId === group.owner.userId,
  )!;
}
async function addSubscription(suffix = 1) {
  const input = {
    endpoint: 'https://fcm.googleapis.com/' + randomUUID(),
    keys: {
      p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, suffix)]).toString('base64url'),
      auth: Buffer.alloc(16, suffix).toString('base64url'),
    },
  };
  const result = await group.owner.client.rpc('save_push_subscription', { input });
  expect(result.error).toBeNull();
  return result.data!;
}
it('current_membership_and_urgent_inventory_are_rechecked_by_database', async () => {
  const day = localDateAt(new Date().toISOString(), 'Asia/Seoul');
  const inserted = await group.owner.client.rpc('create_ingredient', {
    target_fridge_id: group.fridgeId,
    input: { requestId: randomUUID(), name: '통합 검증 재료', storage: 'fridge', expiresOn: day },
  });
  expect(inserted.error).toBeNull();
  await admin
    .from('notification_preferences')
    .update({ enabled: true })
    .eq('user_id', group.member.userId);
  await admin
    .from('notification_preferences')
    .update({ next_run_at: new Date(Date.now() - 1000).toISOString() })
    .eq('user_id', group.member.userId);
  const job = (await claimDueDigests(new Date().toISOString(), 100)).find(
    (j) => j.userId === group.member.userId,
  )!;
  expect(
    (await databaseOutbox.prepare(job))?.digest.groups.some((g) => g.fridgeId === group.fridgeId),
  ).toBe(true);
  expect(
    (await group.outsider.client.rpc('read_notification_digest', { digest_id: job.id })).error,
  ).not.toBeNull();
  await admin
    .from('fridge_members')
    .delete()
    .eq('fridge_id', group.fridgeId)
    .eq('user_id', group.member.userId);
  expect(await databaseOutbox.prepare(job)).toBeNull();
  const clicked = await group.member.client.rpc('read_notification_digest', { digest_id: job.id });
  expect(clicked.error).toBeNull();
  expect((clicked.data as { groups: unknown[] }).groups).toEqual([]);
  await databaseOutbox.finish(job, false);
});
it('retry_sends_only_failed_subscription_and_time_change_cannot_send_twice', async () => {
  const job = await freshJob(),
    one = await addSubscription(1),
    two = await addSubscription(2);
  const send = vi
    .fn()
    .mockImplementation(async (s: { id: string }) => (s.id === one ? 'sent' : 'retry'));
  await dispatchDigest(job, { send }, databaseOutbox);
  expect(send).toHaveBeenCalledTimes(2);
  expect(
    (await admin.from('notification_deliveries').select('*').eq('job_id', job.id)).data,
  ).toHaveLength(1);
  await group.owner.client.rpc('save_notification_preferences', {
    input: { enabled: true, localTime: '23:58' },
  });
  await admin
    .from('notification_jobs')
    .update({ due_at: new Date(Date.now() - 1000).toISOString() })
    .eq('id', job.id);
  const resumed = (await claimDueDigests(new Date().toISOString(), 100)).find(
    (j) => j.id === job.id,
  )!;
  const retry = vi.fn().mockResolvedValue('sent');
  await dispatchDigest(resumed, { send: retry }, databaseOutbox);
  expect(retry).toHaveBeenCalledTimes(1);
  expect(retry.mock.calls[0][0].id).toBe(two);
  expect(retry.mock.calls[0][1].notificationId).toBe(send.mock.calls[0][1].notificationId);
  await group.owner.client.rpc('save_notification_preferences', {
    input: { enabled: true, localTime: '23:59' },
  });
  expect(
    (await admin.from('notification_jobs').select('*').eq('id', job.id).single()).data?.status,
  ).toBe('sent');
  expect(
    (await claimDueDigests(new Date().toISOString(), 100)).filter(
      (j) => j.userId === group.owner.userId,
    ),
  ).toHaveLength(0);
});
it('gone_subscription_is_deleted_by_delivery_rpc', async () => {
  const job = await freshJob(),
    id = await addSubscription();
  await databaseOutbox.record(job, id, 'gone');
  expect((await admin.from('push_subscriptions').select('id').eq('id', id)).data).toEqual([]);
  await databaseOutbox.finish(job, false);
});
it('push_endpoint_cannot_target_private_networks_or_other_websites', async () => {
  for (const endpoint of [
    'http://127.0.0.1/internal',
    'https://127.0.0.1/internal',
    'https://example.com/push',
    'https://fcm.googleapis.com.evil.test/x',
    'https://fcm.googleapis.com:444/x',
  ]) {
    const result = await group.owner.client.rpc('save_push_subscription', {
      input: { endpoint, keys: { p256dh: 'B' + 'A'.repeat(86), auth: 'A'.repeat(22) } },
    });
    expect(result.error?.code).toBe('22023');
  }
});
it('time_change_to_past_retires_today_entirely_unsent_jobs_and_invalidates_leases', async () => {
  for (const status of ['pending', 'retry', 'leased']) {
    const job = await freshJob();
    expect(
      (
        await admin
          .from('notification_jobs')
          .update({ status, due_at: new Date(Date.now() - 1000).toISOString() })
          .eq('id', job.id)
      ).error,
    ).toBeNull();
    const changed = await group.owner.client.rpc('save_notification_preferences', {
      input: { enabled: true, localTime: '00:00' },
    });
    expect(changed.error).toBeNull();
    expect(localDateAt(changed.data!.next_run_at!, 'Asia/Seoul')).not.toBe(job.localDate);
    const retired = await admin
      .from('notification_jobs')
      .select('status,lease_token,lease_until')
      .eq('id', job.id)
      .single();
    expect(retired.data).toEqual({ status: 'skipped', lease_token: null, lease_until: null });
    expect(await databaseOutbox.prepare(job)).toBeNull();
    expect(
      (await claimDueDigests(new Date().toISOString(), 100)).filter(
        (j) => j.userId === group.owner.userId,
      ),
    ).toHaveLength(0);
  }
});
