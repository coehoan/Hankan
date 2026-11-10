import 'server-only';
import type { RecipeCandidate, RecommendationInput } from '@/features/ai/contracts';
import { getAiProvider } from '@/features/ai/registry';
import { validateRecipeCandidates } from './validation';

export async function loadAiRecipes(input: RecommendationInput): Promise<RecipeCandidate[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(async () => {
        const output = await getAiProvider().recommendRecipes(structuredClone(input));
        return deduplicateRecipes(await validateRecipeCandidates(output));
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Recommendation timed out')), 50_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function deduplicateRecipes(recipes: RecipeCandidate[]): RecipeCandidate[] {
  const names = new Set<string>(),
    ids = new Set<string>();
  return recipes.filter((recipe) => {
    const name = recipe.name.normalize('NFKC').replace(/\s+/gu, '').toLocaleLowerCase('ko-KR');
    if (names.has(name) || ids.has(recipe.id)) return false;
    names.add(name);
    ids.add(recipe.id);
    return true;
  });
}
