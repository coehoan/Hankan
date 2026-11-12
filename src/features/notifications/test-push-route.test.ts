import { afterEach, expect, it, vi } from 'vitest';
const { send, origin } = vi.hoisted(() => ({ send: vi.fn(), origin: vi.fn() }));
vi.mock('@/features/notifications/subscriptions', () => ({ sendTestPush: send }));
vi.mock('@/lib/auth', () => ({ assertSameOrigin: origin }));
import { POST } from '@/app/api/push/test/route';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it.each(['production', 'test'])('blocks test push outside development (%s)', async (mode) => {
  vi.stubEnv('NODE_ENV', mode);
  expect((await POST(new Request('http://127.0.0.1/api/push/test'))).status).toBe(404);
  expect(send).not.toHaveBeenCalled();
  expect(origin).not.toHaveBeenCalled();
});
it('uses the existing authenticated current-device sender in development', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  expect((await POST(new Request('http://127.0.0.1/api/push/test'))).status).toBe(200);
  expect(origin).toHaveBeenCalledOnce();
  expect(send).toHaveBeenCalledOnce();
});
