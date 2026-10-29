import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Database } from '../../src/lib/supabase/database.types';
import { cleanupTestGroup, localAdmin, seedTestGroup, type GroupFixture } from '../support/db';
import { recommendForFridge } from '../../src/features/recipes/service';
import { POST } from '../../src/app/api/fridges/[fridgeId]/recipes/route';
let activeClient: SupabaseClient<Database>, group: GroupFixture;
let output: unknown;
let providerAction: (() => Promise<void>) | null = null;
let received: unknown;
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => Promise.resolve(activeClient),
}));
vi.mock('@/features/ai/registry', () => ({
  getAiProvider: () => ({
    recommendRecipes: async (input: unknown) => {
      received = input;
      if (providerAction) await providerAction();
      return output;
    },
  }),
}));
const candidate = {
  id: 'egg',
  name: '계란찜',
  ingredients: [
    { name: '달걀', amountText: '2개' },
    { name: '소금', amountText: '조금' },
  ],
  steps: ['잘 익혀요.'],
  prepMinutes: 10,
  servings: 1,
  origin: { kind: 'generated' },
};
beforeAll(async () => {
  group = await seedTestGroup();
  const seeded = await group.owner.client.rpc('create_ingredient', {
    target_fridge_id: group.fridgeId,
    input: { requestId: randomUUID(), name: '계란', storage: 'fridge', expiresOn: '2099-11-05' },
  });
  if (seeded.error || !seeded.data)
    throw new Error('Recipe fixture failed: ' + seeded.error?.message);
  const changed = await group.owner.client.rpc('update_ingredient', {
    target_fridge_id: group.fridgeId,
    ingredient_id: seeded.data.id,
    expected_version: seeded.data.version,
    patch: { remainingPercent: 65 },
  });
  if (changed.error) throw new Error('Recipe fixture update failed');
});
beforeEach(() => {
  activeClient = group.member.client;
  output = [candidate];
  providerAction = null;
  received = null;
});
afterAll(async () => {
  if (group) await cleanupTestGroup(group);
});
const access = () => ({
  userId: group.member.userId,
  fridgeId: group.fridgeId,
  role: 'member' as const,
});
it('invalid_provider_output_keeps_inventory', async () => {
  const before = (
    await localAdmin().from('ingredients').select('*').eq('fridge_id', group.fridgeId)
  ).data;
  output = [{ ...candidate, ingredients: [] }];
  await expect(recommendForFridge(access())).rejects.toMatchObject({ code: 'provider_failed' });
  expect(
    (await localAdmin().from('ingredients').select('*').eq('fridge_id', group.fridgeId)).data,
  ).toEqual(before);
});
it('recipe_request_does_not_change_remaining', async () => {
  expect((await recommendForFridge(access()))[0]).toMatchObject({
    missing: ['소금'],
    kind: 'needs-shopping',
  });
  expect(
    (
      await localAdmin()
        .from('ingredients')
        .select('remaining_percent')
        .eq('fridge_id', group.fridgeId)
        .single()
    ).data?.remaining_percent,
  ).toBe(65);
  expect(received).toMatchObject({
    ingredients: [expect.objectContaining({ fridgeId: group.fridgeId })],
  });
});
it('rejects_unverified_catalog_sources', async () => {
  output = [
    {
      ...candidate,
      origin: {
        kind: 'catalog',
        provider: 'invented',
        recordId: '123',
        sourceUrl: 'https://example.org/fake',
      },
    },
  ];
  await expect(recommendForFridge(access())).rejects.toMatchObject({ code: 'provider_failed' });
});
it('drops_results_if_inventory_changed_during_provider_call', async () => {
  providerAction = async () => {
    const row = await localAdmin()
      .from('ingredients')
      .select('id,version')
      .eq('fridge_id', group.fridgeId)
      .single();
    await group.member.client.rpc('update_ingredient', {
      target_fridge_id: group.fridgeId,
      ingredient_id: row.data!.id,
      expected_version: row.data!.version,
      patch: { name: '달걀' },
    });
  };
  await expect(recommendForFridge(access())).rejects.toMatchObject({ code: 'conflict' });
});
it('rechecks_membership_after_provider_call', async () => {
  providerAction = async () => {
    await localAdmin()
      .from('fridge_members')
      .delete()
      .eq('fridge_id', group.fridgeId)
      .eq('user_id', group.member.userId);
  };
  try {
    await expect(recommendForFridge(access())).rejects.toMatchObject({ code: 'forbidden' });
  } finally {
    await localAdmin()
      .from('fridge_members')
      .insert({ fridge_id: group.fridgeId, user_id: group.member.userId, role: 'member' });
  }
});
it('route_checks_origin_and_returns_private_results', async () => {
  const origin = process.env.NEXT_PUBLIC_SITE_URL!,
    params = Promise.resolve({ fridgeId: group.fridgeId });
  const request = (from: string) =>
    new Request(origin + '/api/fridges/' + group.fridgeId + '/recipes', {
      method: 'POST',
      headers: { Origin: from, 'Content-Type': 'application/json' },
      body: '{}',
    });
  expect((await POST(request('https://other.invalid'), { params })).status).toBe(403);
  const response = await POST(request(origin), { params });
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await response.json()).toMatchObject({
    data: expect.any(Array),
    inventoryVersion: expect.any(String),
    today: expect.any(String),
  });
});
it('provider_sees_only_usable_batches_from_the_selected_fridge', async () => {
  const own = await localAdmin()
    .from('fridges')
    .select('id')
    .eq('owner_user_id', group.member.userId)
    .single();
  const extra: { id: string; fridgeId: string }[] = [];
  try {
    for (const value of [
      { name: '소금', expiresOn: '2000-01-01', fridgeId: group.fridgeId },
      { name: '감자', expiresOn: '2099-11-05', fridgeId: group.fridgeId },
      { name: '개인 당근', expiresOn: '2099-11-05', fridgeId: own.data!.id },
    ]) {
      const created = await group.member.client.rpc('create_ingredient', {
        target_fridge_id: value.fridgeId,
        input: {
          requestId: randomUUID(),
          name: value.name,
          storage: 'fridge',
          expiresOn: value.expiresOn,
        },
      });
      if (created.error) throw new Error('Recipe privacy fixture failed');
      extra.push({ id: created.data!.id, fridgeId: value.fridgeId });
      if (value.name === '감자')
        await group.member.client.rpc('update_ingredient', {
          target_fridge_id: value.fridgeId,
          ingredient_id: created.data!.id,
          expected_version: 1,
          patch: { remainingPercent: 0 },
        });
    }
    await recommendForFridge(access());
    expect(received).toMatchObject({
      ingredients: [expect.objectContaining({ fridgeId: group.fridgeId, remainingPercent: 65 })],
    });
  } finally {
    for (const row of extra) {
      const saved = await localAdmin()
        .from('ingredients')
        .select('version')
        .eq('id', row.id)
        .single();
      await group.member.client.rpc('delete_ingredient', {
        target_fridge_id: row.fridgeId,
        ingredient_id: row.id,
        expected_version: saved.data!.version,
      });
    }
  }
});
