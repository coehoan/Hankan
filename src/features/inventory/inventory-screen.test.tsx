// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ingredient } from './contracts';
import { useInventory } from './use-inventory';
import { InventoryScreen } from './inventory-screen';
vi.mock('./inventory-realtime', () => ({ subscribeToInventory: () => () => {} }));

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const item = (
  id: string,
  name: string,
  fridgeId = A,
  extra: Partial<Ingredient> = {},
): Ingredient => ({
  id,
  fridgeId,
  name,
  normalizedName: name,
  storage: 'fridge',
  expiresOn: '2026-10-29',
  remainingPercent: 100,
  version: 1,
  createdAt: '2026-10-26T00:00:00Z',
  updatedAt: '2026-10-26T00:00:00Z',
  createdBy: 'owner',
  updatedBy: 'owner',
  ...extra,
});
function response(data: unknown, status = 200) {
  return new Response(
    JSON.stringify(
      status === 200 || status === 201
        ? { data }
        : {
            error: {
              code: status === 403 ? 'forbidden' : status === 409 ? 'conflict' : 'internal',
              message: '저장하지 못했어요. 다시 시도해 주세요.',
            },
          },
    ),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}
function deferred() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
let visibility: DocumentVisibilityState = 'visible';
let online = true;
beforeEach(() => {
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  visibility = 'visible';
  online = true;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('inventory request isolation and synchronization', () => {
  it('ignores_late_response_from_previous_fridge', async () => {
    const late = deferred();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: RequestInfo | URL) =>
        String(url).includes(A)
          ? late.promise
          : Promise.resolve(response([item('b', 'B의 당근', B)])),
      ),
    );
    const view = renderHook(({ id }) => useInventory(id), { initialProps: { id: A } });
    view.rerender({ id: B });
    await waitFor(() => expect(view.result.current.items[0]?.name).toBe('B의 당근'));
    await act(async () => late.resolve(response([item('a', 'A의 두부')])));
    expect(view.result.current.items.map((row) => row.name)).toEqual(['B의 당근']);
  });
  it('does_not_apply_a_late_mutation_to_the_next_fridge', async () => {
    const late = deferred();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'PATCH'
          ? late.promise
          : Promise.resolve(
              response(String(url).includes(A) ? [item('a', 'A 두부')] : [item('b', 'B 당근', B)]),
            ),
      ),
    );
    const view = renderHook(({ id }) => useInventory(id), { initialProps: { id: A } });
    await waitFor(() => expect(view.result.current.items).toHaveLength(1));
    let pending!: Promise<Ingredient>;
    act(() => {
      pending = view.result.current.update('a', 1, { remainingPercent: 50 });
    });
    view.rerender({ id: B });
    await waitFor(() => expect(view.result.current.items[0]?.name).toBe('B 당근'));
    await act(async () => {
      late.resolve(response(item('a', 'A 두부', A, { remainingPercent: 50, version: 2 })));
      await pending;
    });
    expect(view.result.current.items.map((row) => row.name)).toEqual(['B 당근']);
    expect(view.result.current.error).toBeNull();
  });
  it('refetches_on_focus_and_after_mutation', async () => {
    let reads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
        Promise.resolve(
          init?.method === 'PATCH'
            ? response(item('a', '수정 응답', A, { version: 2 }))
            : response([item('a', `서버 목록 ${++reads}`)]),
        ),
      ),
    );
    const view = renderHook(() => useInventory(A));
    await waitFor(() => expect(view.result.current.items[0]?.name).toBe('서버 목록 1'));
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(view.result.current.items[0]?.name).toBe('서버 목록 2'));
    await act(async () => {
      await view.result.current.update('a', 1, { remainingPercent: 50 });
    });
    expect(view.result.current.items[0]?.name).toBe('서버 목록 3');
  });
  it('does_not_poll_and_refreshes_only_when_returning_visible_or_online', async () => {
    vi.useFakeTimers();
    let reads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(response([item('a', `재료 ${++reads}`)]))),
    );
    const view = renderHook(() => useInventory(A));
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.result.current.items[0]?.name).toBe('재료 1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(view.result.current.items[0]?.name).toBe('재료 1');
    visibility = 'hidden';
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(view.result.current.items[0]?.name).toBe('재료 1');
    visibility = 'visible';
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(view.result.current.items[0]?.name).toBe('재료 2');
    online = false;
    act(() => window.dispatchEvent(new Event('offline')));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(view.result.current.items[0]?.name).toBe('재료 2');
    expect(view.result.current.online).toBe(false);
    await expect(view.result.current.update('a', 1, { remainingPercent: 5 })).rejects.toThrow();
    online = true;
    await act(async () => window.dispatchEvent(new Event('online')));
    expect(view.result.current.items[0]?.name).toBe('재료 3');
  });
  it('clears_inventory_on_revocation', async () => {
    let revoked = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(revoked ? response(null, 403) : response([item('a', '공유 두부')])),
      ),
    );
    const view = renderHook(() => useInventory(A));
    await waitFor(() => expect(view.result.current.items).toHaveLength(1));
    revoked = true;
    await act(async () => view.result.current.refresh());
    expect(view.result.current.items).toEqual([]);
    expect(view.result.current.revoked).toBe(true);
    await expect(view.result.current.update('a', 1, { remainingPercent: 5 })).rejects.toThrow();
  });
});

describe('inventory controls with real hook and HTTP boundary', () => {
  const show = () =>
    render(<InventoryScreen fridgeId={A} fridgeName="우리집 냉장고" initialToday="2026-10-26" />);
  it('remaining_save_uses_progress_and_success_notice_can_be_dismissed', async () => {
    const pending = deferred();
    let rows = [item('a', '두부')];
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'PATCH' ? pending.promise : Promise.resolve(response(rows)),
      ),
    );
    show();
    const slider = await screen.findByRole('slider', { name: '두부 남은 양' });
    fireEvent.change(slider, { target: { value: '45' } });
    fireEvent.pointerUp(slider);
    expect(screen.getByRole('progressbar', { name: '두부 남은 양 저장 중' })).toBeVisible();
    expect(screen.queryByText('저장 중…')).not.toBeInTheDocument();
    rows = [item('a', '두부', A, { version: 2, remainingPercent: 45 })];
    await act(async () => pending.resolve(response(rows[0])));
    expect(await screen.findByText('남은 양을 저장했어요.')).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '알림 닫기' }));
    expect(screen.queryByText('남은 양을 저장했어요.')).not.toBeInTheDocument();
  });
  it('success_notice_expires_three_seconds_after_the_latest_identical_message', async () => {
    vi.useFakeTimers();
    let row = item('a', '두부');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          row = { ...row, ...JSON.parse(String(init.body)).patch, version: row.version + 1 };
          return response(row);
        }
        return response([row]);
      }),
    );
    show();
    await act(async () => {
      await Promise.resolve();
    });
    async function save(value: string) {
      const slider = screen.getByRole('slider', { name: '두부 남은 양' });
      fireEvent.change(slider, { target: { value } });
      await act(async () => {
        fireEvent.pointerUp(slider);
      });
    }
    await save('45');
    expect(screen.getByText('남은 양을 저장했어요.')).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await save('40');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2999);
    });
    expect(screen.getByText('남은 양을 저장했어요.')).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.queryByText('남은 양을 저장했어요.')).not.toBeInTheDocument();
  });
  it('rollback_failed_remaining_update', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
        Promise.resolve(
          init?.method === 'PATCH' ? response(null, 500) : response([item('a', '두부')]),
        ),
      ),
    );
    show();
    const slider = await screen.findByRole('slider', { name: '두부 남은 양' });
    fireEvent.change(slider, { target: { value: '45' } });
    fireEvent.blur(slider);
    await screen.findByRole('alert');
    await waitFor(() =>
      expect(screen.getByRole('slider', { name: '두부 남은 양' })).toHaveValue('100'),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('다시');
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeVisible();
  });
  it('groups_expired_soon_and_normal_and_filters_by_name_and_storage', async () => {
    const rows = [
      item('a', '두부'),
      item('b', '냉동 만두', A, { storage: 'freezer', expiresOn: '2026-11-10' }),
      item('c', '오래된 우유', A, { expiresOn: '2026-10-25' }),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(response(rows))),
    );
    show();
    await screen.findByRole('button', { name: '두부 수정' });
    expect(screen.getByRole('heading', { name: /기한 지남/ })).toBeVisible();
    expect(screen.getByRole('heading', { name: /먼저 먹어요/ })).toBeVisible();
    expect(screen.getByRole('heading', { name: /조금 더 여유 있어요/ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '냉동' }));
    expect(screen.queryByRole('button', { name: '두부 수정' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '냉동 만두 수정' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '전체' }));
    fireEvent.change(screen.getByRole('searchbox', { name: '재료 이름 검색' }), {
      target: { value: '우유' },
    });
    expect(screen.getByRole('button', { name: '오래된 우유 수정' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '냉동 만두 수정' })).not.toBeInTheDocument();
  });
  it('creates_once_with_required_date_and_preserves_form_during_offline', async () => {
    const saving = deferred();
    let rows: Ingredient[] = [];
    let writes = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'POST' ? (writes++, saving.promise) : Promise.resolve(response(rows)),
      ),
    );
    show();
    fireEvent.click(screen.getByRole('button', { name: '재료 등록' }));
    fireEvent.click(screen.getByRole('button', { name: '직접 입력' }));
    const form = screen.getByRole('form', { name: '재료 등록' });
    fireEvent.change(within(form).getByLabelText('재료 이름'), { target: { value: '방울토마토' } });
    fireEvent.change(within(form).getByLabelText('유통기한'), { target: { value: '2026-11-02' } });
    online = false;
    act(() => window.dispatchEvent(new Event('offline')));
    expect(within(form).getByRole('button', { name: '저장' })).toBeDisabled();
    expect(within(form).getByLabelText('재료 이름')).toHaveValue('방울토마토');
    online = true;
    act(() => window.dispatchEvent(new Event('online')));
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(writes).toBe(1);
    rows = [item('new', '방울토마토', A, { expiresOn: '2026-11-02' })];
    await act(async () => saving.resolve(response(rows[0], 201)));
    await screen.findByRole('button', { name: '방울토마토 수정' });
    expect(screen.queryByRole('form', { name: '재료 등록' })).not.toBeInTheDocument();
  });
  it('delete_and_slider_controls_do_not_open_the_row_editor', async () => {
    let rows = [item('a', '두부')];
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          rows = [];
          return Promise.resolve(response(null));
        }
        return Promise.resolve(response(rows));
      }),
    );
    show();
    const slider = await screen.findByRole('slider', { name: '두부 남은 양' });
    fireEvent.click(slider);
    expect(screen.queryByRole('form', { name: '재료 수정' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '두부 삭제' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '두부 수정' })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('form', { name: '재료 수정' })).not.toBeInTheDocument();
  });
  it('keeps_unsaved_edit_fields_when_a_conflict_arrives', async () => {
    let rows = [item('a', '두부')];
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          rows = [item('a', '먼저 저장된 두부', A, { version: 2 })];
          return Promise.resolve(response(null, 409));
        }
        return Promise.resolve(response(rows));
      }),
    );
    show();
    fireEvent.click(await screen.findByRole('button', { name: '두부 수정' }));
    const form = screen.getByRole('form', { name: '재료 수정' });
    fireEvent.change(within(form).getByLabelText('재료 이름'), {
      target: { value: '내가 손질한 두부' },
    });
    fireEvent.submit(form);
    await waitFor(() => expect(within(form).getByRole('alert')).toBeVisible());
    expect(within(form).getByLabelText('재료 이름')).toHaveValue('내가 손질한 두부');
    fireEvent.click(within(form).getByRole('button', { name: '최신 내용 불러오기' }));
    expect(screen.getByLabelText('재료 이름')).toHaveValue('먼저 저장된 두부');
  });
});
