import { expect, it, vi } from 'vitest';
import type { Tables } from '@/lib/supabase/database.types';
import type { RecipeCandidate } from '@/features/ai/contracts';
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabaseClient: vi.fn() }));
import { runRecipeJob } from './job-worker';
const job = {
  id: 'job',
  snapshot: [],
  today: '2026-11-06',
  catalog_state: 'pending',
  ai_state: 'pending',
} as unknown as Tables<'recipe_jobs'>;
it('closes the unused catalog slot without loading it and waits for AI', async () => {
  let finish!: (value: RecipeCandidate[]) => void;
  const pending = new Promise<RecipeCandidate[]>((resolve) => {
    finish = resolve;
  });
  const publish = vi.fn(async () => {});
  const load = vi.fn(() => pending);
  const run = runRecipeJob(job, publish, load);
  await vi.waitFor(() => expect(publish).toHaveBeenCalledWith('catalog', [], false));
  expect(load).toHaveBeenCalledExactlyOnceWith({ today: job.today, ingredients: [] });
  expect(publish).toHaveBeenCalledTimes(1);
  finish([]);
  await run;
  expect(publish).toHaveBeenCalledWith('ai', [], true);
});
it('resumes only unfinished sources and does not turn publication failure into provider failure', async () => {
  const publish = vi.fn(async () => {
    throw new Error('storage down');
  });
  const load = vi.fn(async () => []);
  await expect(runRecipeJob({ ...job, catalog_state: 'complete' }, publish, load)).rejects.toThrow(
    'deferred',
  );
  expect(load).toHaveBeenCalledTimes(1);
  expect(publish).toHaveBeenCalledTimes(1);
});
it('records AI failure and closes the unused catalog slot', async () => {
  const publish = vi.fn(async () => {});
  await runRecipeJob(job, publish, async () => {
    throw new Error('secret');
  });
  expect(publish).toHaveBeenCalledWith('catalog', [], false);
  expect(publish).toHaveBeenCalledWith('ai', [], false);
});

it('closes an old pending catalog slot without rerunning completed AI', async () => {
  const publish = vi.fn(async () => {});
  const load = vi.fn(async () => []);
  await runRecipeJob({ ...job, ai_state: 'complete' }, publish, load);
  expect(load).not.toHaveBeenCalled();
  expect(publish).toHaveBeenCalledExactlyOnceWith('catalog', [], false);
});
