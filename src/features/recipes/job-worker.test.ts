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
it('publishes first source without waiting for the other and retains independent failures', async () => {
  let finish!: (value: RecipeCandidate[]) => void;
  const pending = new Promise<RecipeCandidate[]>((resolve) => {
    finish = resolve;
  });
  const publish = vi.fn(async () => {});
  const load = vi.fn((source: string) => (source === 'catalog' ? Promise.resolve([]) : pending));
  const run = runRecipeJob(job, publish, load);
  await vi.waitFor(() => expect(publish).toHaveBeenCalledWith('catalog', [], true));
  expect(load).toHaveBeenCalledTimes(2);
  expect(publish).toHaveBeenCalledTimes(1);
  finish([]);
  await run;
  expect(publish).toHaveBeenCalledWith('ai', [], true);
});
it('resumes only unfinished sources and does not turn publication failure into provider failure', async () => {
  const publish = vi.fn(async () => {
    throw new Error('storage down');
  });
  const load = vi.fn(async (source: string) => {
    expect(source).toBe('ai');
    return [];
  });
  await expect(runRecipeJob({ ...job, catalog_state: 'complete' }, publish, load)).rejects.toThrow(
    'deferred',
  );
  expect(load).toHaveBeenCalledTimes(1);
  expect(load.mock.calls[0]?.[0]).toBe('ai');
  expect(publish).toHaveBeenCalledTimes(1);
});
it('records safe provider failure without discarding the other source', async () => {
  const publish = vi.fn(async () => {});
  await runRecipeJob(job, publish, async (source) => {
    if (source === 'ai') throw new Error('secret');
    return [];
  });
  expect(publish).toHaveBeenCalledWith('catalog', [], true);
  expect(publish).toHaveBeenCalledWith('ai', [], false);
});
