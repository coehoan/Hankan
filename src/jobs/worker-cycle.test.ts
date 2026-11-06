import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ claim: vi.fn(), dispatch: vi.fn(), recipes: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabaseClient: () => ({}) }));
vi.mock('@/features/notifications/outbox', () => ({
  claimDueDigests: mocks.claim,
  databaseOutbox: {},
}));
vi.mock('@/features/notifications/dispatcher', () => ({ dispatchDigest: mocks.dispatch }));
vi.mock('@/features/notifications/web-push-transport', () => ({
  createWebPushTransport: () => ({ send: vi.fn() }),
}));
vi.mock('@/features/recipes/job-worker', () => ({ processRecipeJobs: mocks.recipes }));
vi.mock('./cleanup', () => ({ cleanReceipts: async () => ({ deleted: 0, failed: 0 }) }));
vi.mock('./staging-cleanup', () => ({
  cleanupStagedUploads: async () => ({ deleted: 0, failed: 0 }),
}));
import { runCycle } from './worker';
it('starts_recipe_jobs_while_a_daily_digest_is_still_waiting_for_push', async () => {
  let release!: () => void;
  mocks.claim.mockResolvedValue([{}]);
  mocks.dispatch.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  mocks.recipes.mockResolvedValue(undefined);
  const cycle = runCycle();
  try {
    await vi.waitFor(() => expect(mocks.recipes).toHaveBeenCalledOnce(), { timeout: 100 });
  } finally {
    release();
    await cycle;
  }
});
