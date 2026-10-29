// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RecipeList } from './recipe-list';
import type { Ingredient } from '@/features/inventory/contracts';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const item: Ingredient = {
  id: 'egg',
  fridgeId: A,
  name: '달걀',
  normalizedName: '달걀',
  storage: 'fridge',
  expiresOn: '2026-10-29',
  remainingPercent: 100,
  version: 1,
  createdAt: '2026-10-26T00:00:00Z',
  updatedAt: '2026-10-26T00:00:00Z',
  createdBy: 'owner',
  updatedBy: 'owner',
};
const match = {
  recipe: {
    id: 'egg-dish',
    name: '계란찜',
    ingredients: [{ name: '계란', amountText: '2개' }],
    steps: ['달걀을 풀어요.', '천천히 익혀요.'],
    prepMinutes: 10,
    servings: 1,
    origin: { kind: 'generated' },
  },
  missing: [],
  urgentIngredientIds: ['egg'],
  kind: 'available',
};
function response(data: unknown, status = 200) {
  return new Response(
    JSON.stringify(
      status === 200
        ? { data, inventoryVersion: '[["egg",1]]', today: '2026-10-28' }
        : {
            error: {
              code:
                status === 503
                  ? 'provider_unconfigured'
                  : status === 403
                    ? 'forbidden'
                    : 'provider_failed',
              message: '추천을 불러오지 못했어요.',
            },
          },
    ),
    { status },
  );
}
let rows = [item],
  recipeStatus = 200,
  late: Promise<Response> | null = null,
  online = true;
beforeEach(() => {
  rows = [item];
  recipeStatus = 200;
  late = null;
  online = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  vi.stubGlobal(
    'fetch',
    vi.fn((url: RequestInfo | URL) =>
      Promise.resolve(
        String(url).endsWith('/recipes')
          ? (late ?? response([match], recipeStatus))
          : response(rows),
      ),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const show = () =>
  render(<RecipeList fridgeId={A} fridgeName="우리집" initialToday="2026-10-28" />);
it('recipe_request_does_not_change_remaining', async () => {
  show();
  const button = await screen.findByRole('button', { name: '요리 추천 받기' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  fireEvent.click(await screen.findByRole('button', { name: '계란찜 조리법 보기' }));
  expect(screen.getByRole('dialog', { name: '계란찜' })).toBeVisible();
  expect(screen.getByText('2개')).toBeVisible();
  expect(screen.getByText('달걀을 풀어요.')).toBeVisible();
  expect(rows[0].remainingPercent).toBe(100);
  expect(screen.getByText(/AI가 만든 조리법/)).toBeVisible();
});
it('shows_both_groups_and_missing_ingredients', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: RequestInfo | URL) =>
      Promise.resolve(
        String(url).endsWith('/recipes')
          ? response([
              match,
              {
                ...match,
                recipe: { ...match.recipe, id: 'salt-dish', name: '소금 계란찜' },
                missing: ['소금'],
                kind: 'needs-shopping',
              },
            ])
          : response(rows),
      ),
    ),
  );
  show();
  await waitFor(() => expect(screen.getByRole('button', { name: '요리 추천 받기' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '요리 추천 받기' }));
  expect(await screen.findByRole('heading', { name: /조금만 더 사면 만들어요/ })).toBeVisible();
  expect(screen.getByText(/추가할 재료: 소금/)).toBeVisible();
});
it.each([503, 502])('shows_safe_retry_for_provider_status_%s', async (status) => {
  recipeStatus = status;
  show();
  await waitFor(() => expect(screen.getByRole('button', { name: '요리 추천 받기' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '요리 추천 받기' }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: '계란찜 조리법 보기' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '다시 추천 받기' })).toBeEnabled();
});
it('discards_late_recommendation_after_fridge_switch', async () => {
  let resolve!: (r: Response) => void;
  late = new Promise((done) => {
    resolve = done;
  });
  const view = show();
  await waitFor(() => expect(screen.getByRole('button', { name: '요리 추천 받기' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '요리 추천 받기' }));
  view.rerender(<RecipeList fridgeId={B} fridgeName="다른 냉장고" initialToday="2026-10-28" />);
  await act(async () => resolve(response([match])));
  expect(screen.queryByRole('button', { name: '계란찜 조리법 보기' })).not.toBeInTheDocument();
});
it('clears_cards_and_detail_when_inventory_changes', async () => {
  show();
  await waitFor(() => expect(screen.getByRole('button', { name: '요리 추천 받기' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '요리 추천 받기' }));
  fireEvent.click(await screen.findByRole('button', { name: '계란찜 조리법 보기' }));
  rows = [{ ...item, version: 2, remainingPercent: 50 }];
  await act(async () => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.queryByRole('button', { name: '계란찜 조리법 보기' })).not.toBeInTheDocument();
});
it('clears_recommendation_on_revocation', async () => {
  let revoked = false;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: RequestInfo | URL) =>
      Promise.resolve(
        String(url).endsWith('/recipes')
          ? response([match])
          : revoked
            ? response(null, 403)
            : response(rows),
      ),
    ),
  );
  show();
  await waitFor(() => expect(screen.getByRole('button', { name: '요리 추천 받기' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '요리 추천 받기' }));
  await screen.findByRole('button', { name: '계란찜 조리법 보기' });
  revoked = true;
  await act(async () => window.dispatchEvent(new Event('focus')));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: '계란찜 조리법 보기' })).not.toBeInTheDocument(),
  );
});
it('offline_blocks_new_recommendations', async () => {
  show();
  await waitFor(() => expect(screen.getByRole('button', { name: '요리 추천 받기' })).toBeEnabled());
  act(() => {
    online = false;
    window.dispatchEvent(new Event('offline'));
  });
  expect(screen.getByRole('button', { name: '요리 추천 받기' })).toBeDisabled();
});
