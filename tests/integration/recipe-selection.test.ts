import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { cleanupTestGroup, localAdmin, seedTestGroup, type GroupFixture } from '../support/db';

let group: GroupFixture;
let tofu: string, egg: string;
beforeAll(async () => {
  group = await seedTestGroup();
  for (const name of ['두부', '계란']) {
    const result = await group.owner.client.rpc('create_ingredient', {
      target_fridge_id: group.fridgeId,
      input: { requestId: randomUUID(), name, storage: 'fridge', expiresOn: '2099-01-01' },
    });
    if (result.error) throw result.error;
  }
  const { data, error } = await localAdmin()
    .from('ingredients')
    .select('id,name')
    .eq('fridge_id', group.fridgeId);
  if (error) throw error;
  tofu = data!.find((value) => value.name === '두부')!.id;
  egg = data!.find((value) => value.name === '계란')!.id;
});
afterAll(async () => {
  if (group) await cleanupTestGroup(group);
});

it('stores selection with full inventory and fences changed conditions and active jobs', async () => {
  const client = group.member.client;
  const requestId = randomUUID();
  const enqueue = (ids: string[] | undefined, id = requestId) =>
    client.rpc('enqueue_recipe_job', {
      target_fridge_id: group.fridgeId,
      request_id: id,
      ...(ids === undefined ? {} : { selected_ingredient_ids: ids }),
    });
  expect((await enqueue([])).error?.code).toBe('22023');
  expect((await enqueue([randomUUID()])).error?.code).toBe('22023');
  expect((await enqueue([tofu, tofu])).error?.code).toBe('22023');
  expect(
    (
      await group.outsider.client.rpc('enqueue_recipe_job', {
        target_fridge_id: group.fridgeId,
        request_id: randomUUID(),
        selected_ingredient_ids: [tofu],
      })
    ).error?.code,
  ).toBe('42501');
  const first = await enqueue([tofu]);
  expect(first.error).toBeNull();
  expect(first.data!.selected_ingredient_ids).toEqual([tofu]);
  expect(first.data!.snapshot).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: tofu }),
      expect.objectContaining({ id: egg }),
    ]),
  );
  expect((await enqueue([tofu])).data!.id).toBe(first.data!.id);
  expect((await enqueue([egg])).error?.code).toBe('PT409');
  expect((await enqueue([egg], randomUUID())).error?.code).toBe('PT409');
  expect((await enqueue(undefined, randomUUID())).error?.code).toBe('PT409');
  expect((await enqueue([tofu], randomUUID())).data!.id).toBe(first.data!.id);
  const consumed = await group.owner.client.rpc('update_ingredient', {
    target_fridge_id: group.fridgeId,
    ingredient_id: tofu,
    expected_version: 1,
    patch: { remainingPercent: 0 },
  });
  expect(consumed.error).toBeNull();
  expect(consumed.data?.remaining_percent).toBe(0);
  // A lost response still recovers the original snapshot after inventory changes.
  expect((await enqueue([tofu])).data!.id).toBe(first.data!.id);
  expect((await enqueue([tofu], randomUUID())).error?.code).toBe('22023');
  const completed = await localAdmin()
    .from('recipe_jobs')
    .update({ status: 'complete' })
    .eq('id', first.data!.id);
  expect(completed.error).toBeNull();
  const legacy = await enqueue(undefined, randomUUID());
  expect(legacy.error).toBeNull();
  expect(legacy.data!.selected_ingredient_ids).toBeNull();
});
