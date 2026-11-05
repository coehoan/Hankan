import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { RecipeCandidate, RecommendationInput } from '@/features/ai/contracts';
import { AppError } from '@/lib/errors';
const { ai, catalog, registry } = vi.hoisted(() => ({
  ai: vi.fn(),
  catalog: vi.fn(),
  registry: vi.fn(),
}));
vi.mock('@/features/ai/registry', () => ({ getAiProvider: registry }));
vi.mock('./catalog', () => ({
  getRecipeCandidates: catalog,
  getRegisteredRecipe: async () => dbRecipe,
}));
import { getMixedRecipeCandidates } from './recommendations';
const generated: RecipeCandidate = {
  id: 'ai-egg',
  name: '계란볶음밥',
  ingredients: [{ name: '계란', amountText: '2개' }],
  steps: ['팬에서 익혀요.'],
  prepMinutes: 10,
  servings: 1,
  origin: { kind: 'generated' },
};
const dbRecipe: RecipeCandidate = {
  ...generated,
  id: 'foodsafety:28',
  name: '계란찜',
  prepMinutes: null,
  servings: null,
  origin: { kind: 'catalog', provider: '식약처', recordId: '28' },
};
const input: RecommendationInput = { today: '2026-11-05', ingredients: [] };
beforeEach(() => {
  registry.mockReset().mockReturnValue({ recommendRecipes: ai });
  ai.mockReset().mockResolvedValue([generated]);
  catalog.mockReset().mockResolvedValue([dbRecipe]);
});
afterEach(() => vi.useRealTimers());
it('starts_both_sources_concurrently_and_keeps_both_recipes', async () => {
  let finish!: (value: RecipeCandidate[]) => void;
  let finishCatalog!: (value: RecipeCandidate[]) => void;
  catalog.mockReturnValue(
    new Promise((resolve) => {
      finishCatalog = resolve;
    }),
  );
  ai.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const pending = getMixedRecipeCandidates(input);
  await vi.waitFor(() => {
    expect(catalog).toHaveBeenCalledWith(input);
    expect(ai).toHaveBeenCalledWith(input);
  });
  finishCatalog([dbRecipe]);
  finish([generated]);
  expect(await pending).toEqual([dbRecipe, generated]);
});
it('keeps_catalog_when_ai_is_unconfigured_synchronously', async () => {
  registry.mockImplementation(() => {
    throw new AppError('provider_unconfigured', 'secret');
  });
  expect(await getMixedRecipeCandidates(input)).toEqual([dbRecipe]);
});
it('keeps_ai_when_catalog_fails', async () => {
  catalog.mockRejectedValue(new Error('private upstream failure'));
  expect(await getMixedRecipeCandidates(input)).toEqual([generated]);
});
it('isolates_invalid_ai_output', async () => {
  ai.mockResolvedValue([{ ...generated, ingredients: [] }]);
  expect(await getMixedRecipeCandidates(input)).toEqual([dbRecipe]);
});
it('rejects_ai_claiming_a_catalog_origin', async () => {
  ai.mockResolvedValue([dbRecipe]);
  catalog.mockResolvedValue([]);
  expect(await getMixedRecipeCandidates(input)).toEqual([]);
});
it('rejects_catalog_claiming_generated_origin', async () => {
  catalog.mockResolvedValue([generated]);
  expect(await getMixedRecipeCandidates(input)).toEqual([generated]);
});
it('prefers_whole_canonical_recipe_for_duplicate_names', async () => {
  ai.mockResolvedValue([{ ...generated, name: '계란 찜' }]);
  expect(await getMixedRecipeCandidates(input)).toEqual([dbRecipe]);
});
it('returns_empty_when_one_valid_source_has_no_matches', async () => {
  catalog.mockResolvedValue([]);
  ai.mockRejectedValue(new Error('failed'));
  expect(await getMixedRecipeCandidates(input)).toEqual([]);
});
it('sanitizes_both_failures', async () => {
  catalog.mockRejectedValue(new Error('secret db URL'));
  ai.mockRejectedValue(new Error('secret AI key'));
  await expect(getMixedRecipeCandidates(input)).rejects.toMatchObject({ code: 'provider_failed' });
  await expect(getMixedRecipeCandidates(input)).rejects.not.toHaveProperty(
    'message',
    expect.stringContaining('secret'),
  );
});
it('reports_unconfigured_only_when_both_are_unconfigured', async () => {
  catalog.mockRejectedValue(new AppError('provider_unconfigured', 'secret'));
  ai.mockRejectedValue(new AppError('provider_unconfigured', 'secret'));
  await expect(getMixedRecipeCandidates(input)).rejects.toMatchObject({
    code: 'provider_unconfigured',
  });
});
it('keeps_catalog_after_ai_deadline', async () => {
  vi.useFakeTimers();
  ai.mockReturnValue(new Promise(() => {}));
  const pending = getMixedRecipeCandidates(input);
  await vi.advanceTimersByTimeAsync(50_000);
  expect(await pending).toEqual([dbRecipe]);
  expect(vi.getTimerCount()).toBe(0);
});
