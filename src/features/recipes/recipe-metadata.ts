import type { RecipeCandidate } from '@/features/ai/contracts';
export function recipeMetadata(recipe: RecipeCandidate): string {
  return [
    recipe.prepMinutes === null ? '조리 시간 미제공' : `약 ${recipe.prepMinutes}분`,
    recipe.servings === null ? '인분 미제공' : `${recipe.servings}인분`,
  ].join(' · ');
}
