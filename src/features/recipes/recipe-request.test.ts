import { afterEach, expect, it, vi } from 'vitest';
const { enqueue, access, after } = vi.hoisted(() => ({
  enqueue: vi.fn(),
  access: vi.fn(),
  after: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ assertSameOrigin: vi.fn(), requireFridgeAccess: access }));
vi.mock('@/features/recipes/jobs', () => ({ enqueueRecipeJob: enqueue }));
vi.mock('@/features/recipes/job-worker', () => ({ processRecipeJobs: vi.fn() }));
vi.mock('next/server', () => ({ after }));
import { POST } from '@/app/api/fridges/[fridgeId]/recipes/route';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const call = (input: unknown) =>
  POST(
    new Request('http://localhost/api/fridges/' + A + '/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
    { params: Promise.resolve({ fridgeId: A }) },
  );
afterEach(() => vi.resetAllMocks());
it('passes selection IDs with the verified fridge access and keeps legacy requests working', async () => {
  access.mockResolvedValue({ fridgeId: A, userId: 'user' });
  enqueue.mockResolvedValue({ id: B, status: 'queued' });
  expect((await call({ requestId: A, selectedIngredientIds: [B] })).status).toBe(202);
  expect(enqueue).toHaveBeenCalledWith({ fridgeId: A, userId: 'user' }, A, [B]);
  expect(after).toHaveBeenCalledTimes(1);
  expect((await call({ requestId: B })).status).toBe(202);
  expect(enqueue).toHaveBeenLastCalledWith({ fridgeId: A, userId: 'user' }, B, undefined);
});

it('accepts the supported selection size above the inventory mutation body limit', async () => {
  const ids = Array.from(
    { length: 1000 },
    (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  );
  access.mockResolvedValue({ fridgeId: A, userId: 'user' });
  enqueue.mockResolvedValue({ id: B, status: 'queued' });
  expect((await call({ requestId: A, selectedIngredientIds: ids })).status).toBe(202);
  expect(enqueue).toHaveBeenCalledWith(expect.anything(), A, ids);
});
it.each([[], [A, A], ['not-uuid'], null, Array.from({ length: 1001 }, () => A)])(
  'rejects invalid selection %j',
  async (selection) => {
    expect((await call({ requestId: A, selectedIngredientIds: selection })).status).toBe(422);
    expect(enqueue).not.toHaveBeenCalled();
  },
);
