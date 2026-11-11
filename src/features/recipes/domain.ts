import type { Ingredient, ISODate } from '@/features/inventory/contracts';
import type { RecipeCandidate } from '@/features/ai/contracts';
import { urgencyOf, validateISODate } from '@/features/inventory/domain';

const BASIC_WATER = '물';

export type RecipeMatch = {
  recipe: RecipeCandidate;
  missing: string[];
  urgentIngredientIds: string[];
  kind: 'available' | 'needs-shopping';
};
export function normalizeIngredientName(name: string): string {
  const normalized = name
    .replace(/[①-⑳]/gu, '')
    .normalize('NFKC')
    .trim()
    .replace(/^(?:다진|다져진|채 ?썬|썬|잘게 ?썬)\s+/u, '')
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('ko-KR');
  return normalized === '달걀' ? '계란' : normalized;
}
export function inventoryVersion(ingredients: Ingredient[]): string {
  return JSON.stringify(
    ingredients
      .map((item) => [item.id, item.version] as const)
      .sort((a, b) => a[0].localeCompare(b[0])),
  );
}
export function usableIngredients(ingredients: Ingredient[], today: ISODate): Ingredient[] {
  validateISODate(today);
  return ingredients.filter(
    (item) => item.remainingPercent > 0 && urgencyOf(item.expiresOn, today) !== 'expired',
  );
}
export function classifyRecipes(
  candidates: RecipeCandidate[],
  ingredients: Ingredient[],
  today: ISODate,
  selectedIngredientIds?: string[],
): RecipeMatch[] {
  const batches = [...usableIngredients(ingredients, today)].sort(
    (a, b) =>
      a.expiresOn.localeCompare(b.expiresOn) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
  const held = new Map<string, Ingredient>();
  for (const item of batches) {
    const name = normalizeIngredientName(item.name);
    if (name !== BASIC_WATER && !held.has(name)) held.set(name, item);
  }
  const selectedNames =
    selectedIngredientIds === undefined
      ? null
      : new Set(
          batches
            .filter((item) => selectedIngredientIds.includes(item.id))
            .map((item) => normalizeIngredientName(item.name)),
        );
  const ranked = candidates.flatMap((recipe) => {
    const required = new Map<string, string>();
    for (const item of recipe.ingredients) {
      const name = normalizeIngredientName(item.name);
      if (!required.has(name)) required.set(name, item.name);
    }
    if (selectedNames && ![...required.keys()].some((name) => selectedNames.has(name))) return [];
    const matched = [...required.keys()].flatMap((name) =>
      held.has(name) ? [held.get(name)!] : [],
    );
    const onlyWater = required.size === 1 && required.has(BASIC_WATER);
    if (!matched.length && !onlyWater) return [];
    const missing = [...required]
      .filter(([name]) => name !== BASIC_WATER && !held.has(name))
      .map(([, display]) => display);
    const urgent = matched
      .filter((item) => urgencyOf(item.expiresOn, today) === 'soon')
      .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn) || a.id.localeCompare(b.id));
    const result: RecipeMatch = {
      recipe,
      missing,
      urgentIngredientIds: urgent.map((item) => item.id),
      kind: missing.length ? 'needs-shopping' : 'available',
    };
    return [{ result, earliest: urgent[0]?.expiresOn ?? '9999-12-31' }];
  });
  return ranked
    .sort(
      (a, b) =>
        Number(a.result.kind === 'needs-shopping') - Number(b.result.kind === 'needs-shopping') ||
        a.earliest.localeCompare(b.earliest) ||
        b.result.urgentIngredientIds.length - a.result.urgentIngredientIds.length ||
        a.result.missing.length - b.result.missing.length ||
        a.result.recipe.name.localeCompare(b.result.recipe.name, 'ko-KR') ||
        a.result.recipe.id.localeCompare(b.result.recipe.id),
    )
    .map((item) => item.result);
}
