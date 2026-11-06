import { expect, it, vi } from 'vitest';
vi.mock('next/cache', () => {
  throw new Error('Standalone worker has no Next request cache');
});
import { getFoodSafetyRecipes } from './foodsafety';
it('loads_and_reuses_the_catalog_without_a_next_request_context_in_the_standalone_worker', async () => {
  vi.stubEnv('HANKAN_WORKER_MAIN', '1');
  vi.stubEnv('FOODSAFETY_API_KEY', 'local-worker-fixture');
  const fetcher = vi.fn(async () =>
    Response.json({
      COOKRCP01: {
        total_count: '1',
        RESULT: { CODE: 'INFO-000' },
        row: [{ RCP_SEQ: '28', RCP_NM: '계란찜', RCP_PARTS_DTLS: '계란 2개', MANUAL01: '익힌다.' }],
      },
    }),
  );
  vi.stubGlobal('fetch', fetcher);
  try {
    const [first, concurrent] = await Promise.all([getFoodSafetyRecipes(), getFoodSafetyRecipes()]);
    expect(first).toBe(concurrent);
    expect(first[0].id).toBe('foodsafety:28');
    expect(await getFoodSafetyRecipes()).toBe(first);
    expect(fetcher).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  }
});
