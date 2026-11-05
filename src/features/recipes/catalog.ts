import 'server-only';
import type { RecipeCandidate, RecommendationInput } from '@/features/ai/contracts';
import { FOODSAFETY_PROVIDER, getFoodSafetyRecipes } from './foodsafety';
import { classifyRecipes } from './domain';
export async function getRecipeCandidates(input: RecommendationInput): Promise<RecipeCandidate[]> {
  return classifyRecipes(await getFoodSafetyRecipes(), input.ingredients, input.today)
    .slice(0, 12)
    .map((match) => match.recipe);
}
export async function getRegisteredRecipe(
  provider: string,
  recordId: string,
): Promise<RecipeCandidate | null> {
  if (provider !== FOODSAFETY_PROVIDER || !/^\d+$/.test(recordId)) return null;
  return (
    (await getFoodSafetyRecipes()).find(
      (recipe) => recipe.origin.kind === 'catalog' && recipe.origin.recordId === recordId,
    ) ?? null
  );
}
