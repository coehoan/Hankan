import 'server-only';
import type { RecipeCandidate, RecommendationInput } from '@/features/ai/contracts';
import { getAiProvider } from '@/features/ai/registry';
import { AppError } from '@/lib/errors';
import { getRecipeCandidates } from './catalog';
import { validateRecipeCandidates } from './validation';

async function validatedSource(
  load: () => Promise<RecipeCandidate[]>,
  kind: RecipeCandidate['origin']['kind'],
): Promise<RecipeCandidate[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(async () => {
        const output = await load();
        if (!Array.isArray(output) || output.some((item) => item?.origin?.kind !== kind))
          throw new AppError('provider_failed', '요리 정보를 확인하지 못했어요.');
        return validateRecipeCandidates(output);
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Recommendation timed out')), 50_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getMixedRecipeCandidates(
  input: RecommendationInput,
): Promise<RecipeCandidate[]> {
  const results = await Promise.allSettled([
    validatedSource(() => getRecipeCandidates(structuredClone(input)), 'catalog'),
    validatedSource(() => getAiProvider().recommendRecipes(structuredClone(input)), 'generated'),
  ]);
  if (results.every((result) => result.status === 'rejected')) {
    const unconfigured = results.every(
      (result) =>
        result.status === 'rejected' &&
        result.reason instanceof AppError &&
        result.reason.code === 'provider_unconfigured',
    );
    throw new AppError(
      unconfigured ? 'provider_unconfigured' : 'provider_failed',
      '요리 추천을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
    );
  }
  const names = new Set<string>(),
    ids = new Set<string>();
  return results
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    .filter((recipe) => {
      const name = recipe.name.normalize('NFKC').replace(/\s+/gu, '').toLocaleLowerCase('ko-KR');
      if (names.has(name) || ids.has(recipe.id)) return false;
      names.add(name);
      ids.add(recipe.id);
      return true;
    });
}
