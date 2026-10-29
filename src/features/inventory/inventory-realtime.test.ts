import { beforeEach, expect, it, vi } from 'vitest';
import { subscribeToInventory } from './inventory-realtime';
const sdk = vi.hoisted(() => {
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  return {
    channel,
    unsubscribe: vi.fn(),
    client: {
      auth: { onAuthStateChange: vi.fn() },
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(async () => 'ok'),
    },
  };
});
vi.mock('@/lib/supabase/browser', () => ({ createBrowserSupabaseClient: () => sdk.client }));
beforeEach(() => {
  vi.clearAllMocks();
  sdk.client.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: sdk.unsubscribe } },
  });
});
it('subscribes_to_private_fridge_invalidations_and_ignores_callbacks_after_cleanup', async () => {
  const onChange = vi.fn(),
    onStatus = vi.fn();
  const stop = subscribeToInventory('fridge-id', { onChange, onStatus });
  expect(sdk.client.channel).toHaveBeenCalledWith('fridge:fridge-id:inventory', {
    config: { private: true },
  });
  const [type, filter, change] = sdk.channel.on.mock.calls.at(-1)!;
  expect(type).toBe('broadcast');
  expect(filter).toEqual({ event: 'inventory_changed' });
  const status = sdk.channel.subscribe.mock.calls.at(-1)![0];
  change({ payload: { untrusted: 'ignored' } });
  status('SUBSCRIBED');
  expect(onChange).toHaveBeenCalledExactlyOnceWith();
  expect(onStatus).toHaveBeenCalledExactlyOnceWith('SUBSCRIBED');
  stop();
  stop();
  expect(sdk.client.removeChannel).toHaveBeenCalledExactlyOnceWith(sdk.channel);
  expect(sdk.unsubscribe).toHaveBeenCalledOnce();
  change();
  status('CLOSED');
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onStatus).toHaveBeenCalledTimes(1);
  await Promise.resolve();
});
it('notifies_access_loss_on_signout_but_not_token_refresh_or_after_cleanup', () => {
  const onAccessLost = vi.fn();
  const stop = subscribeToInventory('auth', { onChange: vi.fn(), onStatus: vi.fn(), onAccessLost });
  const authChange = sdk.client.auth.onAuthStateChange.mock.calls.at(-1)![0];
  authChange('TOKEN_REFRESHED');
  expect(onAccessLost).not.toHaveBeenCalled();
  authChange('SIGNED_OUT');
  expect(onAccessLost).toHaveBeenCalledOnce();
  stop();
  authChange('SIGNED_OUT');
  expect(onAccessLost).toHaveBeenCalledOnce();
});
it('waits_for_the_previous_topic_to_leave_before_rapid_resubscription', async () => {
  let finish!: (status: string) => void;
  sdk.client.removeChannel.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const callbacks = { onChange: vi.fn(), onStatus: vi.fn() };
  const first = subscribeToInventory('rapid', callbacks);
  first();
  const second = subscribeToInventory('rapid', callbacks);
  expect(sdk.client.channel).toHaveBeenCalledTimes(1);
  finish('ok');
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(sdk.client.channel).toHaveBeenCalledTimes(2);
  second();
});
