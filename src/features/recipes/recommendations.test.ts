import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { RecipeCandidate, RecommendationInput } from '@/features/ai/contracts';
import { AppError } from '@/lib/errors';
import { loadAiRecipes } from './recommendations';
import { parseSavedRecipeCandidates } from './validation';

const { ai, registry } = vi.hoisted(() => ({ ai: vi.fn(), registry: vi.fn() }));
vi.mock('@/features/ai/registry', () => ({ getAiProvider: registry }));

const generated: RecipeCandidate = {
  id: 'ai-egg',
  name: '계란볶음밥',
  ingredients: [{ name: '계란', amountText: '2개' }],
  steps: ['팬에서 익혀요.'],
  prepMinutes: 10,
  servings: 1,
  origin: { kind: 'generated' },
};
const input: RecommendationInput = { today: '2026-11-05', ingredients: [] };

beforeEach(() => {
  registry.mockReset().mockReturnValue({ recommendRecipes: ai });
  ai.mockReset().mockResolvedValue([generated]);
});
afterEach(() => vi.useRealTimers());

it('returns AI recipes once per normalized dish name', async () => {
  ai.mockResolvedValue([generated, { ...generated, id: 'duplicate', name: '계란 볶음밥' }]);
  expect(await loadAiRecipes(input)).toEqual([generated]);
  expect(ai).toHaveBeenCalledExactlyOnceWith(input);
});

it('accepts an empty result', async () => {
  ai.mockResolvedValue([]);
  expect(await loadAiRecipes(input)).toEqual([]);
});

it('accepts saved catalog results for history but rejects catalog claims from AI', async () => {
  const saved: RecipeCandidate = {
    ...generated,
    id: 'foodsafety:28',
    prepMinutes: null,
    servings: null,
    origin: { kind: 'catalog', provider: '식약처', recordId: '28' },
  };
  expect(parseSavedRecipeCandidates([saved])).toEqual([saved]);
  ai.mockResolvedValue([saved]);
  await expect(loadAiRecipes(input)).rejects.toMatchObject({ code: 'provider_failed' });
});

it('keeps the unconfigured provider error and clears its timer', async () => {
  vi.useFakeTimers();
  registry.mockImplementation(() => {
    throw new AppError('provider_unconfigured', 'AI 추천이 아직 연결되지 않았어요.');
  });
  await expect(loadAiRecipes(input)).rejects.toMatchObject({ code: 'provider_unconfigured' });
  expect(vi.getTimerCount()).toBe(0);
});

it('times out when the AI provider stalls and clears its timer', async () => {
  vi.useFakeTimers();
  ai.mockReturnValue(new Promise(() => undefined));
  const rejection = expect(loadAiRecipes(input)).rejects.toThrow('Recommendation timed out');
  await vi.advanceTimersByTimeAsync(50_000);
  await rejection;
  expect(vi.getTimerCount()).toBe(0);
});
