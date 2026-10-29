import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import type { Database } from '../../src/lib/supabase/database.types';
import { cleanupTestGroup, localAdmin, seedTestGroup, type GroupFixture } from '../support/db';
import { PATCH } from '../../src/app/api/preferences/theme/route';
let activeClient: SupabaseClient<Database>, group: GroupFixture;
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => Promise.resolve(activeClient),
}));
const request = (body: unknown, origin = process.env.NEXT_PUBLIC_SITE_URL!) =>
  new Request(process.env.NEXT_PUBLIC_SITE_URL + '/api/preferences/theme', {
    method: 'PATCH',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
beforeAll(async () => {
  group = await seedTestGroup();
  activeClient = group.member.client;
});
afterAll(async () => {
  if (group) await cleanupTestGroup(group);
});
it('saves_only_the_current_users_theme_and_first_render_cookie', async () => {
  const response = await PATCH(request({ preference: 'dark' }));
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(response.headers.get('Set-Cookie')).toMatch(/hankan-theme=dark;.*Path=\//i);
  expect(
    (
      await localAdmin()
        .from('profiles')
        .select('theme_preference')
        .eq('user_id', group.member.userId)
        .single()
    ).data?.theme_preference,
  ).toBe('dark');
  expect(
    (
      await localAdmin()
        .from('profiles')
        .select('theme_preference')
        .eq('user_id', group.owner.userId)
        .single()
    ).data?.theme_preference,
  ).toBe('system');
});
it('rejects_cross_origin_invalid_and_other_user_preferences', async () => {
  expect((await PATCH(request({ preference: 'light' }, 'https://other.invalid'))).status).toBe(403);
  expect((await PATCH(request({ preference: 'unknown' }))).status).toBe(422);
  expect((await PATCH(request({ preference: 'light', userId: group.owner.userId }))).status).toBe(
    422,
  );
});
