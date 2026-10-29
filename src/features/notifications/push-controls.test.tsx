// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { PushControls } from './push-controls';
const browser = vi.hoisted(() => ({
  supportsPush: vi.fn(),
  registerWorker: vi.fn(),
  bindPushIdentity: vi.fn(),
  clearBrowserPush: vi.fn(),
}));
vi.mock('./browser-push', () => browser);
const permission = vi.fn();
beforeEach(() => {
  browser.supportsPush.mockReturnValue(true);
  browser.clearBrowserPush.mockResolvedValue(undefined);
  vi.stubGlobal('Notification', { requestPermission: permission });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () =>
      Response.json({
        data: { userId: 'user', publicKey: 'B' + 'A'.repeat(86), connected: false },
      }),
    ),
  );
  permission.mockResolvedValue('denied');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
it('permission_is_requested_only_by_explicit_click_and_denied_is_explained', async () => {
  render(<PushControls enabled />);
  const button = await screen.findByRole('button', { name: '브라우저 알림 연결' });
  await waitFor(() => expect(button).toBeEnabled());
  expect(permission).not.toHaveBeenCalled();
  fireEvent.click(button);
  await screen.findByText(/알림이 허용되지 않았어요/);
  expect(permission).toHaveBeenCalledTimes(1);
  expect(browser.registerWorker).not.toHaveBeenCalled();
});
it('unsupported_browser_shows_install_guidance_without_requesting_permission', () => {
  browser.supportsPush.mockReturnValue(false);
  render(<PushControls enabled />);
  expect(screen.getByText(/현재 환경에서는 웹 푸시/)).toBeVisible();
  expect(screen.getByText(/홈 화면에 추가/)).toBeVisible();
  expect(permission).not.toHaveBeenCalled();
});
it('disabled_schedule_cannot_connect', async () => {
  render(<PushControls enabled={false} />);
  expect(await screen.findByRole('button', { name: '브라우저 알림 연결' })).toBeDisabled();
  expect(permission).not.toHaveBeenCalled();
});
