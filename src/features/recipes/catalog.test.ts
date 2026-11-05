import { beforeEach, expect, it, vi } from 'vitest';
import type { Ingredient } from '@/features/inventory/contracts';
import { getRecipeCandidates, getRegisteredRecipe } from './catalog';
import { FOODSAFETY_PROVIDER, foodSafetyRecipe } from './foodsafety';
import { validateRecipeCandidates } from './validation';
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('./foodsafety', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./foodsafety')>()),
  getFoodSafetyRecipes: load,
}));
const candidate = foodSafetyRecipe({
  RCP_SEQ: '28',
  RCP_NM: '마늘 계란찜',
  RCP_PARTS_DTLS: '달걀 2개, 다진 마늘 10g',
  MANUAL01: '완전히 익혀요.',
})!;
const food = (id: string, name: string, expiresOn: string): Ingredient => ({
  id,
  name,
  normalizedName: name,
  fridgeId: 'fridge',
  storage: 'fridge',
  expiresOn,
  remainingPercent: 100,
  version: 1,
  createdAt: '',
  updatedAt: '',
  createdBy: '',
  updatedBy: '',
});
beforeEach(() => load.mockResolvedValue([candidate]));
it('returns_only_real_records_that_overlap_usable_ingredients_and_limits_to_twelve', async () => {
  load.mockResolvedValue(
    Array.from({ length: 20 }, (_, index) => ({ ...candidate, id: 'foodsafety:' + index })),
  );
  expect(
    await getRecipeCandidates({
      today: '2026-11-05',
      ingredients: [food('egg', '계란', '2026-11-06')],
    }),
  ).toHaveLength(12);
  expect(
    await getRecipeCandidates({
      today: '2026-11-05',
      ingredients: [food('egg', '계란', '2026-11-04')],
    }),
  ).toEqual([]);
});
it('unknown_sources_do_not_trigger_external_lookup', async () => {
  expect(await getRegisteredRecipe('invented', '28')).toBeNull();
  expect(await getRegisteredRecipe(FOODSAFETY_PROVIDER, '../28')).toBeNull();
  expect(load).not.toHaveBeenCalled();
});
it('replaces_tampered_names_ingredients_and_steps_with_canonical_record', async () => {
  const forged = {
    ...candidate,
    name: '창작 요리',
    ingredients: [{ name: '마늘', amountText: '1kg' }],
    steps: ['가짜 조리법'],
  };
  expect(await validateRecipeCandidates([forged])).toEqual([candidate]);
  await expect(
    validateRecipeCandidates([
      { ...candidate, origin: { kind: 'catalog', provider: FOODSAFETY_PROVIDER, recordId: '999' } },
    ]),
  ).rejects.toMatchObject({ code: 'provider_failed' });
});
