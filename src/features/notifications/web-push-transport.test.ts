import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import webpush from 'web-push';
import { allowedPushEndpoint, createWebPushTransport } from './web-push-transport';
const subscription = {
  id: 's',
  userId: 'u',
  endpoint: 'https://fcm.googleapis.com/test',
  p256dh: 'public',
  auth: 'auth',
};
const payload = {
  notificationId: 'u:day',
  digestId: 'job',
  title: '한칸',
  body: '1개 재료',
  url: '/notifications/job',
};
beforeEach(() => {
  vi.stubEnv('VAPID_SUBJECT', 'mailto:dev@hankan.test');
  vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'public');
  vi.stubEnv('VAPID_PRIVATE_KEY', 'private');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it('gone_is_permanent_but_network_errors_retry_with_a_bounded_timeout', async () => {
  const send = vi
    .spyOn(webpush, 'sendNotification')
    .mockRejectedValueOnce({ statusCode: 410 })
    .mockRejectedValueOnce({ statusCode: 503 })
    .mockResolvedValueOnce({ statusCode: 201, headers: {}, body: '' });
  const transport = createWebPushTransport()!;
  expect(await transport.send(subscription, payload)).toBe('gone');
  expect(await transport.send(subscription, payload)).toBe('retry');
  expect(await transport.send(subscription, payload)).toBe('sent');
  expect(send.mock.calls[0][2]).toMatchObject({ timeout: 10000, TTL: 3600 });
});
it('unsafe_endpoint_never_reaches_network', async () => {
  const send = vi.spyOn(webpush, 'sendNotification');
  for (const endpoint of [
    'https://localhost/x',
    'https://192.168.0.1/x',
    'https://fcm.googleapis.com.evil.test/x',
    'https://user@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:444/x',
  ]) {
    expect(allowedPushEndpoint(endpoint)).toBe(false);
    expect(await createWebPushTransport()!.send({ ...subscription, endpoint }, payload)).toBe(
      'gone',
    );
  }
  expect(send).not.toHaveBeenCalled();
});
it('missing_vapid_does_not_start_dispatch', () => {
  vi.stubEnv('VAPID_PRIVATE_KEY', '');
  expect(createWebPushTransport()).toBeNull();
});
