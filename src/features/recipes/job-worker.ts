import 'server-only';
import type { RecipeCandidate, RecommendationInput } from '@/features/ai/contracts';
import type { Tables, Json } from '@/lib/supabase/database.types';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { usableIngredients } from './domain';
import { jobIngredients } from './jobs';
import { loadRecipeSource } from './recommendations';
import { processRecipeNotifications } from './job-notifications';

type Source = 'catalog' | 'ai';
type Publish = (source: Source, recipes: RecipeCandidate[], succeeded: boolean) => Promise<void>;
export async function runRecipeJob(
  job: Tables<'recipe_jobs'>,
  publish: Publish,
  load: (
    source: Source,
    input: RecommendationInput,
  ) => Promise<RecipeCandidate[]> = loadRecipeSource,
): Promise<void> {
  const input = {
    today: job.today,
    ingredients: usableIngredients(jobIngredients(job), job.today),
  };
  const tasks = (['catalog', 'ai'] as const)
    .filter((source) => job[`${source}_state`] === 'pending')
    .map(async (source) => {
      let recipes: RecipeCandidate[];
      try {
        recipes = await load(source, structuredClone(input));
      } catch {
        await publish(source, [], false);
        return;
      }
      await publish(source, recipes, true);
    });
  const results = await Promise.allSettled(tasks);
  if (results.some((result) => result.status === 'rejected'))
    throw new Error('Recipe publication deferred');
}
export async function processRecipeJobs(jobId?: string): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc(
    'claim_recipe_jobs',
    jobId ? { target_job_id: jobId } : {},
  );
  if (error) throw new Error('Cannot claim recipe jobs');
  const results = await Promise.allSettled(
    (data ?? []).map((job) =>
      runRecipeJob(job, async (source, recipes, succeeded) => {
        const result = await admin.rpc('publish_recipe_source', {
          job_id: job.id,
          token: job.lease_token!,
          source_name: source,
          recipes: recipes as unknown as Json,
          succeeded,
        });
        if (result.error) throw new Error('Cannot publish recipe result');
      }),
    ),
  );
  if (results.some((result) => result.status === 'rejected'))
    throw new Error('Recipe jobs deferred');
  await processRecipeNotifications();
}
