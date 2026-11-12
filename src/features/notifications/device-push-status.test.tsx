// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DevicePushStatus } from './device-push-status';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function setup(permission: NotificationPermission, connected = true, subscribed = true) {
  const requestPermission = vi.fn();
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('Notification', { permission, requestPermission });
  vi.stubGlobal('PushManager', function () {});
  vi.stubGlobal(
    'navigator',
    Object.create(navigator, {
      serviceWorker: {
        value: {
          getRegistration: vi.fn(async () => ({
            pushManager: { getSubscription: async () => (subscribed ? {} : null) },
          })),
        },
      },
    }),
  );
  const fetcher = vi.fn(async () => Response.json({ data: { connected } }));
  vi.stubGlobal('fetch', fetcher);
  return { requestPermission, fetcher };
}
it.each([
  [true, true],
  [true, false],
  [false, true],
])(
  'checks both the server registration and browser subscription (%s, %s)',
  async (connected, subscribed) => {
    const { requestPermission, fetcher } = setup('granted', connected, subscribed);
    render(<DevicePushStatus revision="" onConnect={vi.fn()} />);
    if (connected && subscribed) {
      expect(await screen.findByText('이 기기의 알림 권한과 연결이 확인됐어요.')).toBeVisible();
      expect(screen.queryByRole('button', { name: '이 기기 알림 연결' })).toBeNull();
    } else expect(await screen.findByRole('button', { name: '이 기기 알림 연결' })).toBeEnabled();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      '/api/push/subscriptions',
      expect.objectContaining({ cache: 'no-store' }),
    );
  },
);
it('waits for an explicit device connection gesture before requesting permission', async () => {
  const { requestPermission, fetcher } = setup('default');
  const connect = vi.fn(async () => {});
  render(<DevicePushStatus revision="" onConnect={connect} />);
  expect(requestPermission).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button', { name: '이 기기 알림 연결' }));
  expect(connect).toHaveBeenCalledOnce();
});
it('explains blocked permissions and can recheck after the browser setting changes', async () => {
  setup('denied');
  render(<DevicePushStatus revision="" onConnect={vi.fn()} />);
  expect(await screen.findByText(/이 기기의 알림이 차단됐어요/)).toBeVisible();
  expect(screen.queryByRole('button', { name: '이 기기 알림 연결' })).toBeNull();
  vi.stubGlobal('Notification', { permission: 'granted' });
  fireEvent.click(screen.getByRole('button', { name: '연결 상태 다시 확인' }));
  expect(await screen.findByText('이 기기의 알림 권한과 연결이 확인됐어요.')).toBeVisible();
});
