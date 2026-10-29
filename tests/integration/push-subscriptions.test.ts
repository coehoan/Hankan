import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/supabase/database.types';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { localAdmin, seedTestGroup, cleanupTestGroup, type GroupFixture } from '../support/db';
import { GET, POST, DELETE } from '../../src/app/api/push/subscriptions/route';
import { signOut } from '../../src/features/auth/actions';
let group: GroupFixture, client: SupabaseClient<Database>;
const jar = new Map<string, string>();
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => Promise.resolve(client),
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (key: string) => (jar.has(key) ? { value: jar.get(key) } : undefined),
    set: (key: string, value: string) => jar.set(key, value),
    delete: (key: string) => jar.delete(key),
  }),
}));
const request = (method: string, input: unknown = {}, origin = process.env.NEXT_PUBLIC_SITE_URL!) =>
  new Request(process.env.NEXT_PUBLIC_SITE_URL + '/api/push/subscriptions', {
    method,
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
const subscription = () => ({
  endpoint: 'https://fcm.googleapis.com/' + randomUUID(),
  expirationTime: null,
  keys: { p256dh: 'B' + 'A'.repeat(86), auth: 'A'.repeat(22) },
});
beforeAll(async () => {
  group = await seedTestGroup();
  client = group.owner.client;
  await client.rpc('save_notification_preferences', {
    input: { enabled: true, localTime: '23:59' },
  });
});
afterAll(async () => {
  if (group) await cleanupTestGroup(group);
});
it('register_and_disconnect_only_the_bound_browser', async () => {
  const other = await client.rpc('save_push_subscription', { input: subscription() });
  expect(other.error).toBeNull();
  expect((await POST(request('POST', subscription()))).status).toBe(200);
  const id = jar.get('hankan-push-id');
  expect(id).toBeTruthy();
  expect((await (await GET()).json()).data.connected).toBe(true);
  expect((await DELETE(request('DELETE'))).status).toBe(200);
  expect(jar.has('hankan-push-id')).toBe(false);
  const rows = await localAdmin()
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', group.owner.userId);
  expect(rows.data?.map((s) => s.id)).toEqual([other.data]);
});
it('cross_origin_and_invalid_endpoint_are_rejected', async () => {
  expect((await POST(request('POST', subscription(), 'https://evil.test'))).status).toBe(403);
  expect(
    (await POST(request('POST', { ...subscription(), endpoint: 'https://127.0.0.1/private' })))
      .status,
  ).toBe(422);
});
it('logout_removes_this_browser_before_ending_session_and_keeps_other_devices', async () => {
  expect((await POST(request('POST', subscription()))).status).toBe(200);
  const id = jar.get('hankan-push-id')!;
  await signOut();
  expect(jar.has('hankan-push-id')).toBe(false);
  expect((await localAdmin().from('push_subscriptions').select('id').eq('id', id)).data).toEqual(
    [],
  );
  expect(
    (await localAdmin().from('push_subscriptions').select('id').eq('user_id', group.owner.userId))
      .data,
  ).toHaveLength(1);
  expect((await GET()).status).toBe(401);
});
