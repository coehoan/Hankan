// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/features/inventory/inventory-realtime', () => ({
  subscribeToInventory: () => () => {},
}));
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
        ? { data: Array.isArray(data) && data[0]?.recipe ? savedJob(data) : data }
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
function savedJob(matches: unknown[], status = 'complete') {
  return {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    fridgeId: A,
    status,
    matches,
    ingredients: [item],
    inventoryVersion: '[["egg",1]]',
    today: '2026-10-28',
    createdAt: '2026-10-28T00:00:00Z',
    completedAt: status === 'complete' ? '2026-10-28T00:01:00Z' : null,
  };
}
let rows = [item],
  recipeStatus = 200,
  late: Promise<Response> | null = null,
  online = true;
let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
  user = userEvent.setup();
  rows = [item];
  recipeStatus = 200;
  late = null;
  online = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  vi.stubGlobal(
    'fetch',
    vi.fn((url: RequestInfo | URL) =>
      Promise.resolve(
        String(url).includes('/api/recipe-jobs/')
          ? response(savedJob([match]))
          : String(url).includes('/api/recipe-jobs')
            ? response([])
            : String(url).endsWith('/recipes')
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

it('retries inventory in place when the recommendation screen cannot load ingredients', async () => {
  let reads = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith('/ingredients'))
        return ++reads === 1 ? response(null, 503) : response(rows);
      return response([]);
    }),
  );
  show();
  await user.click(await screen.findByRole('button', { name: '재료 다시 불러오기' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '요리 추천 받기' })).toBeEnabled());
  expect(reads).toBe(2);
});
it('does not render an empty recipe category before available results', async () => {
  show();
  await waitFor(() => expect(screen.getByRole('button', { name: '요리 추천 받기' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: '요리 추천 받기' }));
  await screen.findByRole('button', { name: '계란찜 조리법 보기' });
  expect(
    screen.queryByRole('heading', { name: /조금만 더 사면 만들어요/ }),
  ).not.toBeInTheDocument();
});

it('selects ingredient types, preserves hidden selections and posts IDs from duplicate batches', async () => {
  rows = [item, { ...item, id: 'egg-2', name: '계란' }, { ...item, id: 'tofu', name: '두부' }];
  show();
  await waitFor(() => expect(screen.getByRole('button', { name: '요리 추천 받기' })).toBeEnabled());
  await user.click(screen.getByRole('radio', { name: '재료 골라서' }));
  const submit = screen.getByRole('button', { name: '선택한 재료로 추천받기' });
  expect(submit).toBeDisabled();
  expect(screen.getAllByRole('button', { name: /선택$/ })).toHaveLength(2);
  await user.click(screen.getByRole('button', { name: '계란 선택' }));
  await user.type(screen.getByRole('searchbox', { name: '재료 검색' }), '두부');
  expect(screen.queryByRole('button', { name: '계란 선택' })).toBeNull();
  await user.click(submit);
  const post = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST');
  expect(JSON.parse(String(post![1]!.body)).selectedIngredientIds).toEqual(['egg', 'egg-2']);
});

it('keeps selected conditions unchanged when recovering a lost POST response', async () => {
  const requests: Record<string, unknown>[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        requests.push(JSON.parse(String(init.body)));
        if (requests.length === 1) throw new TypeError('lost');
        return Response.json(
          { data: { ...savedJob([], 'queued'), selectedIngredientIds: ['egg'] } },
          { status: 202 },
        );
      }
      return response(String(url).includes('/api/recipe-jobs') ? [] : rows);
    }),
  );
  show();
  await waitFor(() => expect(screen.getByRole('button', { name: '요리 추천 받기' })).toBeEnabled());
  await user.click(screen.getByRole('radio', { name: '재료 골라서' }));
  await user.click(screen.getByRole('button', { name: '달걀 선택' }));
  await user.click(screen.getByRole('button', { name: '선택한 재료로 추천받기' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('radio', { name: '전체 재료' })).toBeDisabled();
  await act(async () => window.dispatchEvent(new Event('focus')));
  await screen.findByRole('button', { name: '추천 중…' });
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(requests[1].selectedIngredientIds).toEqual(['egg']);
});
it('keeps recommendations disabled without an extra notice when inventory is empty', async () => {
  rows = [];
  show();

  await waitFor(() =>
    expect(screen.queryByText('현재 냉장고 재료를 확인하고 있어요…')).not.toBeInTheDocument(),
  );
  expect(screen.getByRole('button', { name: '요리 추천 받기' })).toBeDisabled();
  expect(screen.queryByRole('heading', { name: '추천에 쓸 재료가 아직 없어요' })).toBeNull();
  expect(screen.queryByRole('link', { name: '재료 확인하기' })).toBeNull();
});
it('recipe_request_does_not_change_remaining', async () => {
  show();
  const button = await screen.findByRole('button', { name: '요리 추천 받기' });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  await user.click(await screen.findByRole('button', { name: '계란찜 조리법 보기' }));
  expect(screen.getByRole('dialog', { name: '계란찜' })).toBeVisible();
  expect(screen.getByText('2개')).toBeVisible();
  expect(screen.getByText('달걀을 풀어요.')).toBeVisible();
  expect(rows[0].remainingPercent).toBe(100);
  expect(screen.queryByText(/AI가 만든 조리법/)).not.toBeInTheDocument();
});
it('shows_both_sources_in_one_list_without_source_or_invented_metadata', async () => {
  const catalogMatch = {
    ...match,
    recipe: {
      ...match.recipe,
      id: 'foodsafety:28',
      name: '새우 두부 계란찜',
      prepMinutes: null,
      servings: null,
      ingredientsText: '주재료: 달걀(2개)\n양념: 물 약간',
      origin: {
        kind: 'catalog',
        provider: '식품의약품안전처 조리식품 레시피 DB',
        recordId: '28',
        sourceUrl: 'https://www.foodsafetykorea.go.kr/api/openApiInfo.do?svc_no=COOKRCP01',
      },
    },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn((url: RequestInfo | URL) =>
      Promise.resolve(
        String(url).includes('/api/recipe-jobs')
          ? response([])
          : String(url).endsWith('/recipes')
            ? response([match, catalogMatch])
            : response(rows),
      ),
    ),
  );
  show();
  const button = await screen.findByRole('button', { name: '요리 추천 받기' });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  expect(await screen.findByText('조리 시간 미제공 · 인분 미제공')).toBeVisible();
  expect(screen.getByRole('button', { name: '계란찜 조리법 보기' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: '새우 두부 계란찜 조리법 보기' }));
  expect(screen.getByText('주재료: 달걀(2개) 양념: 물 약간')).toBeVisible();
  expect(screen.queryByText(/식품의약품안전처|식약처|레시피 출처/)).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '출처 보기' })).not.toBeInTheDocument();
  expect(screen.queryByText(/AI가 만든 조리법/)).not.toBeInTheDocument();
  expect(screen.queryByText(/null인분|약 0분/)).not.toBeInTheDocument();
});
it('shows_both_groups_and_missing_ingredients', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: RequestInfo | URL) =>
      Promise.resolve(
        String(url).includes('/api/recipe-jobs')
          ? response([])
          : String(url).endsWith('/recipes')
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
  await user.click(screen.getByRole('button', { name: '요리 추천 받기' }));
  expect(await screen.findByRole('heading', { name: /조금만 더 사면 만들어요/ })).toBeVisible();
  expect(screen.getByText(/추가할 재료: 소금/)).toBeVisible();
});
it.each([503, 502])('shows_safe_retry_for_provider_status_%s', async (status) => {
  recipeStatus = status;
  show();
  await waitFor(() => expect(screen.getByRole('button', { name: '요리 추천 받기' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: '요리 추천 받기' }));
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
  await user.click(screen.getByRole('button', { name: '요리 추천 받기' }));
  view.rerender(<RecipeList fridgeId={B} fridgeName="다른 냉장고" initialToday="2026-10-28" />);
  await act(async () => resolve(response([match])));
  expect(screen.queryByRole('button', { name: '계란찜 조리법 보기' })).not.toBeInTheDocument();
});
it('preserves_snapshot_cards_and_warns_when_inventory_changes', async () => {
  show();
  await waitFor(() => expect(screen.getByRole('button', { name: '요리 추천 받기' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: '요리 추천 받기' }));
  await user.click(await screen.findByRole('button', { name: '계란찜 조리법 보기' }));
  rows = [{ ...item, version: 2, remainingPercent: 50 }];
  await act(async () => window.dispatchEvent(new Event('focus')));
  await waitFor(() =>
    expect(screen.getByText(/추천을 요청한 뒤 재료나 날짜가 바뀌었어요/)).toBeVisible(),
  );
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(screen.getByRole('button', { name: '계란찜 조리법 보기' })).toBeVisible();
});
it('clears_recommendation_on_revocation', async () => {
  let revoked = false;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: RequestInfo | URL) =>
      Promise.resolve(
        String(url).includes('/api/recipe-jobs')
          ? revoked
            ? response(null, 403)
            : response([])
          : String(url).endsWith('/recipes')
            ? response([match])
            : revoked
              ? response(null, 403)
              : response(rows),
      ),
    ),
  );
  show();
  await waitFor(() => expect(screen.getByRole('button', { name: '요리 추천 받기' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: '요리 추천 받기' }));
  expect(fetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/recipes$/),
    expect.objectContaining({ method: 'POST' }),
  );
  await screen.findByRole('button', { name: '계란찜 조리법 보기' });
  revoked = true;
  await act(async () => window.dispatchEvent(new Event('focus')));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: '계란찜 조리법 보기' })).not.toBeInTheDocument(),
  );
});
it('shows_accepted_and_partial_results_then_restores_completed_history_on_remount', async () => {
  let job = savedJob([], 'queued');
  vi.stubGlobal(
    'fetch',
    vi.fn((url: RequestInfo | URL) =>
      Promise.resolve(
        Response.json({
          data: String(url).endsWith('/recipes')
            ? job
            : String(url).includes('/api/recipe-jobs/')
              ? job
              : String(url).includes('/api/recipe-jobs')
                ? []
                : rows,
        }),
      ),
    ),
  );
  const view = show();
  await waitFor(() => expect(screen.getByRole('button', { name: '요리 추천 받기' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: '요리 추천 받기' }));
  expect(await screen.findByText('요리를 추천하고 있어요')).toBeVisible();
  expect(
    screen.getByText('결과는 추천 내역에 저장돼요. 알림을 켜 두면 완료 소식도 받아요.'),
  ).toBeVisible();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.queryByText(/물은 기본으로 있어요/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '추천 중…' })).toBeDisabled();
  job = savedJob([match], 'running');
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(await screen.findByRole('button', { name: '계란찜 조리법 보기' })).toBeVisible();
  expect(screen.getByText(/먼저 준비된 요리부터/)).toBeVisible();
  job = savedJob([match]);
  view.unmount();
  vi.stubGlobal(
    'fetch',
    vi.fn((url: RequestInfo | URL) =>
      Promise.resolve(
        Response.json({ data: String(url).includes('/api/recipe-jobs') ? [job] : rows }),
      ),
    ),
  );
  show();
  expect(await screen.findByRole('button', { name: '계란찜 조리법 보기' })).toBeVisible();
  expect(screen.queryByRole('link', { name: '추천 내역' })).not.toBeInTheDocument();
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
it('recovers_an_accepted_request_after_its_response_is_lost_while_an_old_result_is_displayed', async () => {
  const old = savedJob([match]),
    next = { ...savedJob([], 'queued'), id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' };
  const requestIds: string[] = [];
  let lost = true;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        requestIds.push(JSON.parse(String(init.body)).requestId);
        if (lost) {
          lost = false;
          throw new TypeError('connection lost after server accepted');
        }
        return Response.json({ data: next }, { status: 202 });
      }
      return Response.json({
        data: String(url).includes('/api/recipe-jobs/')
          ? String(url).endsWith(next.id)
            ? next
            : old
          : String(url).includes('/api/recipe-jobs')
            ? [old]
            : rows,
      });
    }),
  );
  show();
  await screen.findByRole('button', { name: '계란찜 조리법 보기' });
  await user.click(screen.getByRole('button', { name: '다시 추천 받기' }));
  await screen.findByRole('alert');
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(await screen.findByRole('button', { name: '추천 중…' })).toBeDisabled();
  expect(requestIds).toHaveLength(2);
  expect(requestIds[0]).toBe(requestIds[1]);
  Object.assign(next, savedJob([match]), { id: next.id });
  await act(async () => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(screen.getByRole('button', { name: '다시 추천 받기' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: '다시 추천 받기' }));
  expect(requestIds).toHaveLength(3);
  expect(requestIds[2]).not.toBe(requestIds[1]);
});
