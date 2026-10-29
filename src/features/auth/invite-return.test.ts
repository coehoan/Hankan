import { beforeEach, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/auth/[action]/route';
const auth = vi.hoisted(() => ({ signup: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ auth: { signUp: auth.signup } }),
}));
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://127.0.0.1:3000');
  auth.signup.mockResolvedValue({
    data: { session: { access_token: 'test-only-session' } },
    error: null,
  });
});
const request = (next: string) =>
  new Request('http://127.0.0.1:3000/api/auth/sign-up', {
    method: 'POST',
    headers: { Origin: 'http://127.0.0.1:3000', 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'invite_user', password: 'Test-password-123!', next }),
  });
it('immediate_signup_preserves_the_validated_invite', async () => {
  const next = '/invite/' + 'a'.repeat(43),
    response = await POST(request(next), { params: Promise.resolve({ action: 'sign-up' }) });
  expect(response.status).toBe(200);
  expect((await response.json()).data.nextPath).toBe(next);
  expect(auth.signup).toHaveBeenCalledWith({
    email: 'invite_user@accounts.hankan.invalid',
    password: 'Test-password-123!',
    options: { data: { display_name: 'invite_user' } },
  });
});
it('signup_cannot_redirect_to_external_origin', async () => {
  const response = await POST(request('https://foreign.invalid'), {
    params: Promise.resolve({ action: 'sign-up' }),
  });
  expect((await response.json()).data.nextPath).toBe('/');
});
