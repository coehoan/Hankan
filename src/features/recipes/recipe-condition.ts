import { normalizeIngredientName } from './domain';
import type { RecipeJob } from './job-contracts';

export function recipeCondition(job: RecipeJob): string {
  if (!job.selectedIngredientIds) return '전체 재료로 추천';
  const names = new Map<string, string>();
  for (const item of job.ingredients) {
    if (job.selectedIngredientIds.includes(item.id)) {
      const key = normalizeIngredientName(item.name);
      if (!names.has(key)) names.set(key, item.name);
    }
  }
  return '선택 재료: ' + [...names.values()].join(' · ');
}
