import { expect, it } from 'vitest';
import { createSelectedProvider, type AiUsage } from '../../src/features/ai/selected-provider';
import { validateRecipeCandidates } from '../../src/features/recipes/validation';
import {
  recipeInput,
  renderReceipt,
  receiptScore,
  type RecipeFixture,
} from '../support/ai-fixtures';
import receipts from '../fixtures/ai/receipts.json';
import recipes from '../fixtures/ai/recipes.json';
// Paid calls are opt-in. Skips are never counted as live verification.
const live = process.env.HANKAN_AI_LIVE === '1';
function selected() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for live verification');
  const reports: AiUsage[] = [];
  return {
    reports,
    provider: createSelectedProvider({
      apiKey,
      model: 'gpt-6-luna',
      onUsage: (usage) => reports.push(usage),
    }),
  };
}
it.skipIf(!live)(
  'live_korean_receipt_extracts_items_without_expiry_or_nonfood',
  async () => {
    const { provider, reports } = selected(),
      fixture = receipts[1];
    const items = await provider.extractReceipt(await renderReceipt(fixture));
    expect(receiptScore(fixture, items)).toMatchObject({
      hits: 3,
      missing: 0,
      unexpected: 0,
      excludedDetected: 0,
    });
    expect(items.every((item) => !Object.hasOwn(item, 'expiresOn'))).toBe(true);
    expect(reports[0].inputTokens).toBeGreaterThan(0);
    expect(reports[0].totalTokens).toBeGreaterThan(0);
  },
  60_000,
);
it.skipIf(!live)(
  'live_recipes_have_complete_ingredients_steps_and_generated_origin',
  async () => {
    const { provider, reports } = selected();
    const candidates = await validateRecipeCandidates(
      await provider.recommendRecipes(recipeInput(recipes[0] as RecipeFixture)),
    );
    expect(candidates.length).toBeGreaterThan(0);
    for (const recipe of candidates) {
      expect(recipe.ingredients.length).toBeGreaterThan(0);
      expect(recipe.steps.length).toBeGreaterThan(0);
      expect(recipe.prepMinutes).toBeGreaterThan(0);
      expect(recipe.servings).toBeGreaterThan(0);
      expect(recipe.origin).toEqual({ kind: 'generated' });
    }
    expect(reports[0].outputTokens).toBeGreaterThan(0);
  },
  60_000,
);
