import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { cleanupTestGroup, localAdmin, seedTestGroup, type GroupFixture } from '../support/db';

let group: GroupFixture;
let aliasedRequestId: string, originalJobId: string;
beforeAll(async () => {
  group = await seedTestGroup();
  const result = await group.owner.client.rpc('create_ingredient', {
    target_fridge_id: group.fridgeId,
    input: { requestId: randomUUID(), name: '계란', storage: 'fridge', expiresOn: '2099-01-01' },
  });
  if (result.error) throw new Error('Cannot seed recipe ingredients');
});
afterAll(async () => {
  if (group) await cleanupTestGroup(group);
});

it('enqueues_once_and_takes_a_server_snapshot_without_changing_inventory', async () => {
  const requestId = randomUUID();
  const client = group.member.client;
  const before = await localAdmin().from('ingredients').select('*').eq('fridge_id', group.fridgeId);
  // RPC types are regenerated after the migration is applied locally.
  const first = await client.rpc('enqueue_recipe_job', {
    target_fridge_id: group.fridgeId,
    request_id: requestId,
  });
  expect(first.error).toBeNull();
  expect(first.data).toMatchObject({
    user_id: group.member.userId,
    status: 'queued',
    snapshot: before.data,
  });
  const second = await client.rpc('enqueue_recipe_job', {
    target_fridge_id: group.fridgeId,
    request_id: requestId,
  });
  expect(second.data?.id).toBe(first.data?.id);
  aliasedRequestId = randomUUID();
  originalJobId = first.data!.id;
  const duplicate = await client.rpc('enqueue_recipe_job', {
    target_fridge_id: group.fridgeId,
    request_id: aliasedRequestId,
  });
  expect(duplicate.data?.id).toBe(first.data?.id);
  expect(
    (await localAdmin().from('ingredients').select('*').eq('fridge_id', group.fridgeId)).data,
  ).toEqual(before.data);
});

it('hides_other_users_history_and_denies_client_writes_and_worker_claims', async () => {
  const denied = await group.outsider.client.rpc('enqueue_recipe_job', {
    target_fridge_id: group.fridgeId,
    request_id: randomUUID(),
  });
  expect(denied.error?.code).toBe('42501');
  expect(
    (await group.owner.client.from('recipe_jobs').select('id').eq('fridge_id', group.fridgeId))
      .data,
  ).toEqual([]);
  expect(
    (
      await group.member.client
        .from('recipe_jobs')
        .update({ status: 'complete' })
        .eq('fridge_id', group.fridgeId)
    ).error,
  ).not.toBeNull();
  expect((await group.member.client.rpc('claim_recipe_jobs', {})).error?.code).toBe('42501');
});

it('fences_expired_workers_and_preserves_first_source_while_second_is_pending', async () => {
  const admin = localAdmin();
  const queued = await group.member.client.rpc('enqueue_recipe_job', {
    target_fridge_id: group.fridgeId,
    request_id: randomUUID(),
  });
  const claimed = await admin.rpc('claim_recipe_jobs', { target_job_id: queued.data!.id });
  expect(claimed.error).toBeNull();
  const job = claimed.data![0];
  expect((await admin.rpc('claim_recipe_jobs', { target_job_id: job.id })).data).toEqual([]);
  const recipes = [{ id: 'test', name: '계란찜' }];
  expect(
    (
      await admin.rpc('publish_recipe_source', {
        job_id: job.id,
        token: job.lease_token!,
        source_name: 'catalog',
        recipes,
        succeeded: true,
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await admin
        .from('recipe_jobs')
        .select('status,catalog_recipes,ai_state')
        .eq('id', job.id)
        .single()
    ).data,
  ).toEqual({ status: 'running', catalog_recipes: recipes, ai_state: 'pending' });
  await admin.from('recipe_jobs').update({ lease_until: '2000-01-01T00:00:00Z' }).eq('id', job.id);
  const reclaimed = (await admin.rpc('claim_recipe_jobs', { target_job_id: job.id })).data![0];
  expect(reclaimed.lease_token).not.toBe(job.lease_token);
  const stale = await admin.rpc('publish_recipe_source', {
    job_id: job.id,
    token: job.lease_token!,
    source_name: 'ai',
    recipes: [],
    succeeded: true,
  });
  expect(stale.data).toBe(false);
  await admin.rpc('publish_recipe_source', {
    job_id: job.id,
    token: reclaimed.lease_token!,
    source_name: 'ai',
    recipes: [],
    succeeded: false,
  });
  expect(
    (await admin.from('recipe_jobs').select('status,catalog_recipes').eq('id', job.id).single())
      .data,
  ).toEqual({ status: 'complete', catalog_recipes: recipes });
});

it('retries_an_active_job_alias_after_completion_without_creating_another_job', async () => {
  const retried = await group.member.client.rpc('enqueue_recipe_job', {
    target_fridge_id: group.fridgeId,
    request_id: aliasedRequestId,
  });
  expect(retried.error).toBeNull();
  expect(retried.data?.id).toBe(originalJobId);
});
it('revoked_members_cannot_read_or_publish_saved_work', async () => {
  const queued = await group.member.client.rpc('enqueue_recipe_job', {
    target_fridge_id: group.fridgeId,
    request_id: randomUUID(),
  });
  const admin = localAdmin();
  const job = (await admin.rpc('claim_recipe_jobs', { target_job_id: queued.data!.id })).data![0];
  await admin
    .from('fridge_members')
    .delete()
    .eq('fridge_id', group.fridgeId)
    .eq('user_id', group.member.userId);
  try {
    expect(
      (await group.member.client.from('recipe_jobs').select('id').eq('id', job.id)).data,
    ).toEqual([]);
    expect(
      (
        await admin.rpc('publish_recipe_source', {
          job_id: job.id,
          token: job.lease_token!,
          source_name: 'ai',
          recipes: [],
          succeeded: true,
        })
      ).data,
    ).toBe(false);
    expect(
      (await admin.from('recipe_jobs').select('status').eq('id', job.id).single()).data?.status,
    ).toBe('cancelled');
  } finally {
    await admin
      .from('fridge_members')
      .insert({ fridge_id: group.fridgeId, user_id: group.member.userId, role: 'member' });
  }
});
it('gates_completion_push_by_current_opt_in_and_fences_delivery_retries', async () => {
  const admin = localAdmin(),
    userId = group.owner.userId;
  const queued = await group.owner.client.rpc('enqueue_recipe_job', {
    target_fridge_id: group.fridgeId,
    request_id: randomUUID(),
  });
  const job = (await admin.rpc('claim_recipe_jobs', { target_job_id: queued.data!.id })).data![0];
  for (const source of ['catalog', 'ai'])
    expect(
      (
        await admin.rpc('publish_recipe_source', {
          job_id: job.id,
          token: job.lease_token!,
          source_name: source,
          recipes: [],
          succeeded: true,
        })
      ).data,
    ).toBe(true);
  const sub = await admin
    .from('push_subscriptions')
    .insert({
      user_id: userId,
      endpoint: 'https://fcm.googleapis.com/recipe-test-' + randomUUID(),
      p256dh: 'test-only',
      auth: 'test-only',
    })
    .select('id')
    .single();
  expect(sub.error).toBeNull();
  await admin.from('notification_preferences').update({ enabled: true }).eq('user_id', userId);
  const claimed = (await admin.rpc('claim_recipe_notifications')).data!.find(
    (value) => value.id === job.id,
  )!;
  expect(claimed.notify_token).toBeTruthy();
  expect(
    (
      await group.owner.client.rpc('prepare_recipe_notification', {
        job_id: job.id,
        token: claimed.notify_token!,
      })
    ).error?.code,
  ).toBe('42501');
  const before = await admin.rpc('prepare_recipe_notification', {
    job_id: job.id,
    token: claimed.notify_token!,
  });
  expect(before.error).toBeNull();
  expect(before.data).toEqual([expect.objectContaining({ id: sub.data!.id })]);
  expect(
    (
      await admin.rpc('record_recipe_notification', {
        job_id: job.id,
        token: randomUUID(),
        subscription_id: sub.data!.id,
      })
    ).data,
  ).toBe(false);
  expect(
    (
      await admin.rpc('record_recipe_notification', {
        job_id: job.id,
        token: claimed.notify_token!,
        subscription_id: sub.data!.id,
      })
    ).data,
  ).toBe(true);
  expect(
    (
      await admin.rpc('prepare_recipe_notification', {
        job_id: job.id,
        token: claimed.notify_token!,
      })
    ).data,
  ).toEqual([]);
  await admin.from('notification_preferences').update({ enabled: false }).eq('user_id', userId);
  expect(
    (
      await admin.rpc('prepare_recipe_notification', {
        job_id: job.id,
        token: claimed.notify_token!,
      })
    ).data,
  ).toBeNull();
  expect(
    (await admin.from('recipe_jobs').select('notified_at').eq('id', job.id).single()).data
      ?.notified_at,
  ).toBeTruthy();
});
