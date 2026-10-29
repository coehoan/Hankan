// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useInventory } from './use-inventory';
const subscriptions = vi.hoisted(
  () =>
    [] as {
      id: string;
      change: () => void;
      lost: () => void;
      status: (status: string) => void;
      stop: ReturnType<typeof vi.fn>;
    }[],
);
vi.mock('./inventory-realtime', () => ({
  subscribeToInventory: (
    id: string,
    callbacks: {
      onChange: () => void;
      onStatus: (status: string) => void;
      onAccessLost: () => void;
    },
  ) => {
    const stop = vi.fn();
    subscriptions.push({
      id,
      change: callbacks.onChange,
      lost: callbacks.onAccessLost,
      status: callbacks.onStatus,
      stop,
    });
    return stop;
  },
}));
let online = true;
let visibility = 'visible';
const response = (name: string, status = 200) =>
  Response.json(
    status === 200
      ? { data: [{ id: name, name }] }
      : { error: { code: 'forbidden', message: '접근 권한이 없어요.' } },
    { status },
  );
const flush = async (time = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(time);
  });
beforeEach(() => {
  subscriptions.length = 0;
  online = true;
  visibility = 'visible';
  vi.useFakeTimers();
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
    () => visibility as DocumentVisibilityState,
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('has_no_periodic_reads_and_debounces_burst_signals', async () => {
  let reads = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response('재료 ' + ++reads)),
  );
  const view = renderHook(() => useInventory('a'));
  await flush();
  expect(subscriptions).toHaveLength(1);
  expect(reads).toBe(1);
  await flush(30000);
  expect(reads).toBe(1);
  act(() => {
    subscriptions[0].change();
    subscriptions[0].change();
    subscriptions[0].change();
  });
  await flush(250);
  expect(reads).toBe(2);
  expect(view.result.current.items[0].name).toBe('재료 2');
});
it('revalidates_after_subscription_and_reconnection_without_polling', async () => {
  let reads = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response('재료 ' + ++reads)),
  );
  renderHook(() => useInventory('a'));
  await flush();
  act(() => subscriptions[0].status('SUBSCRIBED'));
  await flush(250);
  expect(reads).toBe(2);
  act(() => subscriptions[0].status('CHANNEL_ERROR'));
  await flush(250);
  const afterError = reads;
  await flush(30000);
  expect(reads).toBe(afterError);
  act(() => subscriptions[0].status('SUBSCRIBED'));
  await flush(250);
  expect(reads).toBe(afterError + 1);
});
it('queues_an_invalidation_received_while_a_read_is_in_flight', async () => {
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const fetcher = vi.fn().mockReturnValueOnce(pending).mockResolvedValue(response('최신'));
  vi.stubGlobal('fetch', fetcher);
  const view = renderHook(() => useInventory('a'));
  act(() => subscriptions[0].change());
  await flush(250);
  await act(async () => finish(response('이전')));
  await flush(250);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(view.result.current.items[0].name).toBe('최신');
});
it('disconnects_while_hidden_and_ignores_old_events_after_switch_and_unmount', async () => {
  const fetcher = vi.fn(async () => response('목록'));
  vi.stubGlobal('fetch', fetcher);
  const view = renderHook(({ id }) => useInventory(id), { initialProps: { id: 'a' } });
  await flush();
  const first = subscriptions[0];
  visibility = 'hidden';
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(first.stop).toHaveBeenCalledOnce();
  act(() => first.change());
  await flush(500);
  expect(fetcher).toHaveBeenCalledTimes(1);
  visibility = 'visible';
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  await flush();
  expect(subscriptions).toHaveLength(2);
  view.rerender({ id: 'b' });
  await flush();
  expect(subscriptions[1].stop).toHaveBeenCalledOnce();
  const reads = fetcher.mock.calls.length;
  act(() => {
    first.change();
    subscriptions[1].status('SUBSCRIBED');
  });
  await flush(500);
  expect(fetcher).toHaveBeenCalledTimes(reads);
  view.unmount();
  expect(subscriptions[2].stop).toHaveBeenCalledOnce();
  act(() => subscriptions[2].change());
  await flush(500);
  expect(fetcher).toHaveBeenCalledTimes(reads);
});
it('membership_invalidation_clears_revoked_inventory_and_stops_the_subscription', async () => {
  let revoked = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response('두부', revoked ? 403 : 200)),
  );
  const view = renderHook(() => useInventory('a'));
  await flush();
  revoked = true;
  act(() => subscriptions[0].change());
  await flush(250);
  expect(view.result.current.items).toEqual([]);
  expect(view.result.current.revoked).toBe(true);
  expect(subscriptions[0].stop).toHaveBeenCalledOnce();
});
it('preserves_changes_during_a_mutation_and_reloads_after_saving', async () => {
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  let reads = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: unknown, init?: RequestInit) =>
      init?.method === 'PATCH' ? pending : response(++reads === 1 ? '처음' : '다른 멤버의 변경'),
    ),
  );
  const view = renderHook(() => useInventory('a'));
  await flush();
  let saving!: Promise<unknown>;
  act(() => {
    saving = view.result.current.update('처음', 1, { remainingPercent: 50 });
  });
  act(() => subscriptions[0].change());
  await flush(250);
  expect(reads).toBe(1);
  await act(async () => {
    finish(Response.json({ data: { id: '처음', name: '내 수정' } }));
    await saving;
  });
  expect(reads).toBe(2);
  expect(view.result.current.items[0].name).toBe('다른 멤버의 변경');
});
it('disconnects_offline_and_keeps_connection_errors_visible_until_resubscribed', async () => {
  const fetcher = vi.fn(async () => response('목록'));
  vi.stubGlobal('fetch', fetcher);
  const view = renderHook(() => useInventory('a'));
  await flush();
  act(() => subscriptions[0].status('TIMED_OUT'));
  expect(view.result.current.error?.code).toBe('realtime_connection');
  await act(async () => view.result.current.refresh());
  expect(view.result.current.error?.code).toBe('realtime_connection');
  online = false;
  act(() => window.dispatchEvent(new Event('offline')));
  expect(subscriptions[0].stop).toHaveBeenCalledOnce();
  const count = fetcher.mock.calls.length;
  await flush(30000);
  expect(fetcher).toHaveBeenCalledTimes(count);
  online = true;
  act(() => window.dispatchEvent(new Event('online')));
  await flush();
  expect(subscriptions).toHaveLength(2);
  act(() => subscriptions[1].status('SUBSCRIBED'));
  await flush(250);
  expect(view.result.current.error).toBeNull();
});
it('clears_inventory_immediately_on_signout_and_ignores_late_signals', async () => {
  const fetcher = vi.fn(async () => response('두부'));
  vi.stubGlobal('fetch', fetcher);
  const view = renderHook(() => useInventory('a'));
  await flush();
  act(() => subscriptions[0].lost());
  expect(view.result.current.items).toEqual([]);
  expect(view.result.current.revoked).toBe(true);
  expect(subscriptions[0].stop).toHaveBeenCalledOnce();
  act(() => subscriptions[0].change());
  await flush(30000);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('never_restores_private_rows_when_a_pending_write_fails_after_signout', async () => {
  let finish!: (response: Response) => void;
  let writeSignal: AbortSignal | undefined;
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        writeSignal = init.signal!;
        return pending;
      }
      return response('비공개 재료');
    }),
  );
  const view = renderHook(() => useInventory('a'));
  await flush();
  let saving!: Promise<unknown>;
  act(() => {
    saving = view.result.current
      .update('비공개 재료', 1, { remainingPercent: 50 })
      .catch(() => undefined);
  });
  act(() => subscriptions[0].lost());
  expect(view.result.current.items).toEqual([]);
  await act(async () => {
    finish(Response.json({ error: { message: '서버 오류' } }, { status: 500 }));
    await saving;
  });
  expect(view.result.current.revoked).toBe(true);
  expect(view.result.current.items).toEqual([]);
  expect(writeSignal?.aborted).toBe(true);
});
