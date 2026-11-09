// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NotificationSettingsForm } from './settings-form';
const original = {
  enabled: false,
  localTime: '09:00',
  timezone: 'Asia/Seoul',
  nextRunAt: null as string | null,
};
let saved = { ...original },
  fail = false,
  patches = 0,
  online = true;
beforeEach(() => {
  saved = { ...original };
  fail = false;
  patches = 0;
  online = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  vi.stubGlobal('fetch', async (_url: unknown, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      patches++;
      if (fail)
        return Response.json({ error: { message: '설정을 저장하지 못했어요.' } }, { status: 500 });
      const input = JSON.parse(String(init.body));
      saved = { ...saved, ...input, nextRunAt: input.enabled ? '2026-10-26T11:30:00Z' : null };
    }
    return Response.json({ data: saved });
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const show = () => render(<NotificationSettingsForm />);
const ready = () => screen.findByRole('switch', { name: '알림 받기' });
it('requests device permission only on enabling, without delaying the account save', async () => {
  let answer!: (value: NotificationPermission) => void;
  const requestPermission = vi.fn(
    () => new Promise<NotificationPermission>((resolve) => (answer = resolve)),
  );
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('Notification', { permission: 'default', requestPermission });
  vi.stubGlobal('PushManager', function () {});
  vi.stubGlobal('navigator', Object.create(navigator, { serviceWorker: { value: {} } }));

  show();
  const toggle = await ready();
  expect(requestPermission).not.toHaveBeenCalled();
  fireEvent.click(toggle);
  expect(requestPermission).toHaveBeenCalledOnce();
  await screen.findByText('알림 설정을 저장했어요.');
  expect(saved.enabled).toBe(true);

  await act(async () => answer('denied'));
  expect(screen.getByText(/기기 설정에서 한칸의 알림 권한을 확인해 주세요/)).toBeVisible();
  fireEvent.change(screen.getByLabelText('매일 받을 시각'), { target: { value: '20:30' } });
  await screen.findByText('알림 설정을 저장했어요.');
  fireEvent.click(toggle);
  await screen.findByText('알림을 껐어요.');
  expect(requestPermission).toHaveBeenCalledOnce();
  expect(screen.queryByText(/기기 설정에서 한칸의 알림 권한을 확인해 주세요/)).toBeNull();
});
it.each([true, false])('connects the device only while still enabled (%s)', async (stayEnabled) => {
  let answer!: (value: NotificationPermission) => void;
  const requestPermission = vi.fn(
    () => new Promise<NotificationPermission>((resolve) => (answer = resolve)),
  );
  const subscribe = vi.fn().mockResolvedValue({ toJSON: () => ({ endpoint: 'device' }) });
  const registration = {
    active: {
      state: 'activated',
      postMessage: (_message: unknown, ports?: MessagePort[]) => ports?.[0].postMessage(true),
    },
    update: vi.fn().mockResolvedValue(undefined),
    pushManager: { getSubscription: async () => null, subscribe },
  };
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('Notification', { permission: 'default', requestPermission });
  vi.stubGlobal('PushManager', function () {});
  vi.stubGlobal(
    'navigator',
    Object.create(navigator, {
      serviceWorker: {
        value: { register: async () => registration, ready: Promise.resolve(registration) },
      },
    }),
  );
  const preferences = fetch;
  const api = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/settings/notifications') return preferences(url, init);
    if (url === '/api/push/subscriptions' && !init?.method)
      return Response.json({ data: { userId: 'user', publicKey: 'QQ', connected: false } });
    if (url === '/api/push/subscriptions' && init?.method === 'POST')
      return new Response(null, { status: saved.enabled ? 200 : 400 });
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', api);

  show();
  const toggle = await ready();
  fireEvent.click(toggle);
  expect(requestPermission).toHaveBeenCalledOnce();
  await screen.findByText('알림 설정을 저장했어요.');
  if (!stayEnabled) {
    fireEvent.click(toggle);
    await screen.findByText('알림을 껐어요.');
  }
  await act(async () => answer('granted'));
  if (stayEnabled) await screen.findByText('이 기기에서 알림을 받을 수 있어요.');
  expect(screen.queryByRole('button', { name: '테스트 알림 보내기' })).not.toBeInTheDocument();
  expect(subscribe).toHaveBeenCalledTimes(stayEnabled ? 1 : 0);
  expect(api.mock.calls.filter(([, init]) => init?.method === 'POST').map(([url]) => url)).toEqual(
    stayEnabled ? ['/api/push/subscriptions'] : [],
  );
});
it('hides the time when notifications are off', async () => {
  show();
  const toggle = await ready();
  expect(toggle).not.toBeChecked();
  expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('매일 받을 시각')).not.toBeInTheDocument();
  expect(patches).toBe(0);
});
it('saves the toggle and time as soon as they change', async () => {
  show();
  fireEvent.click(await ready());
  await screen.findByText('알림 설정을 저장했어요.');
  expect(saved).toMatchObject({ enabled: true, localTime: '09:00' });
  expect(screen.getByLabelText('매일 받을 시각')).toHaveValue('09:00');
  expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('매일 받을 시각'), { target: { value: '20:30' } });
  await screen.findByText('알림 설정을 저장했어요.');
  expect(saved).toMatchObject({ enabled: true, localTime: '20:30' });
  expect(patches).toBe(2);
});
it('rolls back when turning on fails and allows retrying the toggle', async () => {
  fail = true;
  show();
  fireEvent.click(await ready());
  await screen.findByRole('alert');
  expect(screen.getByRole('switch')).not.toBeChecked();
  expect(saved.enabled).toBe(false);
  fail = false;
  fireEvent.click(screen.getByRole('switch'));
  await screen.findByText('알림 설정을 저장했어요.');
  expect(saved.enabled).toBe(true);
});
it('off_saves_immediately_even_with_a_cleared_time', async () => {
  saved = { ...saved, enabled: true };
  show();
  await ready();
  fireEvent.change(screen.getByLabelText('매일 받을 시각'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('switch', { name: '알림 받기' }));
  await screen.findByText('알림을 껐어요.');
  expect(saved).toMatchObject({ enabled: false, localTime: '09:00', nextRunAt: null });
  expect(patches).toBe(1);
  expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
});
it('restores the last saved time when re-enabled', async () => {
  saved = { ...saved, enabled: true, localTime: '20:30' };
  let view = show();
  fireEvent.click(await ready());
  await screen.findByText('알림을 껐어요.');
  view.unmount();
  view = show();
  expect(await ready()).not.toBeChecked();
  fireEvent.click(screen.getByRole('switch'));
  expect(screen.getByLabelText('매일 받을 시각')).toHaveValue('20:30');
  await screen.findByText('알림 설정을 저장했어요.');
  expect(saved.enabled).toBe(true);
  expect(patches).toBe(2);
});
it('restores the last saved time when saving a new time fails', async () => {
  saved = { ...saved, enabled: true, localTime: '20:30' };
  fail = true;
  show();
  await ready();
  fireEvent.change(screen.getByLabelText('매일 받을 시각'), { target: { value: '22:30' } });
  await screen.findByRole('alert');
  expect(screen.getByRole('switch')).toBeChecked();
  expect(screen.getByLabelText('매일 받을 시각')).toHaveValue('20:30');
  expect(saved.localTime).toBe('20:30');
  fail = false;
  fireEvent.click(screen.getByRole('switch'));
  await screen.findByText('알림을 껐어요.');
  expect(saved.enabled).toBe(false);
});
it('queues the latest time and toggle while an earlier change is being saved', async () => {
  saved = { ...saved, enabled: true };
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  vi.stubGlobal('fetch', async (_url: unknown, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      if (++patches === 1) await gate;
      saved = { ...saved, ...JSON.parse(String(init.body)) };
    }
    return Response.json({ data: saved });
  });
  show();
  await ready();
  const time = screen.getByLabelText('매일 받을 시각');
  fireEvent.change(time, { target: { value: '19:00' } });
  fireEvent.change(time, { target: { value: '20:00' } });
  fireEvent.click(screen.getByRole('switch'));
  expect(patches).toBe(1);
  await act(async () => finish());
  expect(saved).toMatchObject({ enabled: false, localTime: '20:00' });
  expect(screen.getByRole('switch')).not.toBeChecked();
  expect(patches).toBe(2);
});
it('blocks changes while offline', async () => {
  saved = { ...saved, enabled: true };
  show();
  await ready();
  act(() => {
    online = false;
    window.dispatchEvent(new Event('offline'));
  });
  expect(screen.getByRole('switch')).toBeDisabled();
  expect(screen.getByLabelText('매일 받을 시각')).toBeDisabled();
  expect(screen.getByLabelText('매일 받을 시각')).toHaveValue('09:00');
  expect(patches).toBe(0);
});
it('failed_load_has_no_fake_defaults_and_can_retry', async () => {
  let bad = true;
  vi.stubGlobal('fetch', async () =>
    bad
      ? Response.json({ error: { message: '설정을 불러오지 못했어요.' } }, { status: 500 })
      : Response.json({ data: saved }),
  );
  show();
  await screen.findByRole('alert');
  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  bad = false;
  fireEvent.click(screen.getByRole('button', { name: '설정 다시 불러오기' }));
  expect(await ready()).not.toBeChecked();
});
