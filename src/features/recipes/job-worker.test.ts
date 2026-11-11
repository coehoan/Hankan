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

it('passes selected IDs and filters unrelated AI results before publication', async () => {
  const row = (id: string, name: string) => ({
    id,
    name,
    normalized_name: name,
    storage: 'fridge',
    created_at: '2026-11-06',
    expires_on: '2099-01-01',
    remaining_percent: 100,
  });
  const snapshot = [row('tofu', '두부'), row('egg', '계란'), row('salt', '소금')];
  const candidate = (name: string): RecipeCandidate => ({
    id: name,
    name,
    ingredients: [{ name, amountText: '1개' }],
    steps: ['익힌다'],
    prepMinutes: 10,
    servings: 1,
    origin: { kind: 'generated' },
  });
  const load = vi.fn(async (_input: import('@/features/ai/contracts').RecommendationInput) => {
    void _input;
    return [candidate('두부'), candidate('계란')];
  });
  const publish = vi.fn(async () => {});
  await runRecipeJob({ ...job, snapshot, selected_ingredient_ids: ['tofu'] }, publish, load);
  expect(load.mock.calls[0][0]).toMatchObject({ selectedIngredientIds: ['tofu'] });
  expect(load.mock.calls[0][0].ingredients).toHaveLength(3);
  expect(publish).toHaveBeenCalledWith('ai', [candidate('두부')], true);
});
