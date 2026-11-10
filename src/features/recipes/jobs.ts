import 'server-only';
import type { AccessContext } from '@/lib/contracts';
import { requireUser } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/supabase/database.types';
import { checkDatabaseError, toIngredient } from '@/features/inventory/service';
import { parseId } from '@/features/inventory/domain';
import { classifyRecipes, inventoryVersion } from './domain';
import { deduplicateRecipes } from './recommendations';
import { parseSavedRecipeCandidates } from './validation';
import type { RecipeJob, RecipeJobStatus } from './job-contracts';

const recipeJobNotFound = () =>
  new AppError('not_found', '추천 내역을 찾을 수 없어요. 냉장고 권한도 확인해 주세요.');

export function jobIngredients(row: Tables<'recipe_jobs'>) {
  if (!Array.isArray(row.snapshot))
    throw new AppError('internal', '저장된 재료를 확인하지 못했어요.');
  return row.snapshot.map((item) => toIngredient(item as unknown as Tables<'ingredients'>));
}
export function toRecipeJob(row: Tables<'recipe_jobs'>): RecipeJob {
  const ingredients = jobIngredients(row);
  const recipes = deduplicateRecipes([
    ...parseSavedRecipeCandidates(row.catalog_recipes),
    ...parseSavedRecipeCandidates(row.ai_recipes),
  ]);
  return {
    id: row.id,
    fridgeId: row.fridge_id,
    status: row.status as RecipeJobStatus,
    matches: classifyRecipes(recipes, ingredients, row.today),
    ingredients,
    inventoryVersion: inventoryVersion(ingredients),
    today: row.today,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}
export async function enqueueRecipeJob(
  access: AccessContext,
  requestId: string,
): Promise<RecipeJob> {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc('enqueue_recipe_job', {
    target_fridge_id: access.fridgeId,
    request_id: parseId(requestId),
  });
  if (error?.code === 'PT429')
    throw new AppError('conflict', '추천 요청이 많아요. 잠시 후 다시 시도해 주세요.');
  if (error) checkDatabaseError(error);
  if (!data) throw new AppError('internal', '추천을 접수하지 못했어요. 다시 시도해 주세요.');
  if (data.history_hidden_at) throw recipeJobNotFound();
  return toRecipeJob(data);
}
export async function getRecipeJob(id: string): Promise<RecipeJob> {
  await requireUser();
  const client = await createServerSupabaseClient();
  const { data, error } = await client
    .from('recipe_jobs')
    .select('*')
    .eq('id', parseId(id))
    .maybeSingle();
  if (error) checkDatabaseError(error);
  if (!data) throw recipeJobNotFound();
  return toRecipeJob(data);
}
export async function hideRecipeJob(id: string): Promise<void> {
  const { userId } = await requireUser();
  const { error } = await createAdminSupabaseClient().rpc('hide_recipe_job', {
    target_job_id: parseId(id),
    actor_id: userId,
  });
  if (error?.code === 'PT404') throw recipeJobNotFound();
  if (error?.code === 'PT409') throw new AppError('conflict', '추천이 끝난 뒤 삭제할 수 있어요.');
  if (error) throw new AppError('internal', '추천 내역을 삭제하지 못했어요.');
}
export async function listRecipeJobs(fridgeId?: string, latest = false): Promise<RecipeJob[]> {
  await requireUser();
  const client = await createServerSupabaseClient();
  let query = client
    .from('recipe_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(latest ? 1 : 30);
  if (fridgeId) query = query.eq('fridge_id', parseId(fridgeId));
  const { data, error } = await query;
  if (error) checkDatabaseError(error);
  return (data ?? []).map(toRecipeJob);
}
export async function listRecipeActivity(): Promise<{ id: string; status: string }[]> {
  await requireUser();
  const client = await createServerSupabaseClient();
  const { data, error } = await client
    .from('recipe_jobs')
    .select('id,status')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) checkDatabaseError(error);
  return data ?? [];
}
