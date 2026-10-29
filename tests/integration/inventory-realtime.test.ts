import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  seedTestGroup,
  cleanupTestGroup,
  localAdmin,
  type GroupFixture,
  type TestIdentity,
} from '../support/db';
let group: GroupFixture;
const channels: { identity: TestIdentity; channel: RealtimeChannel }[] = [];
beforeAll(async () => {
  group = await seedTestGroup();
});
afterAll(async () => {
  for (const { identity, channel } of channels) await identity.client.removeChannel(channel);
  if (group) {
    for (const identity of [group.owner, group.member, group.outsider])
      await identity.client.realtime.disconnect();
    await cleanupTestGroup(group);
  }
});
async function listen(identity: TestIdentity, fridgeId = group.fridgeId, allowDenied = false) {
  await identity.client.realtime.setAuth();
  const messages: { event: string; payload?: unknown }[] = [];
  const channel = identity.client.channel('fridge:' + fridgeId + ':inventory', {
    config: { private: true },
  });
  channels.push({ identity, channel });
  const status = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Local Realtime subscription timed out')),
      8000,
    );
    channel
      .on('broadcast', { event: 'inventory_changed' }, (message) => messages.push(message))
      .subscribe((next) => {
        if (next === 'SUBSCRIBED' || (allowDenied && next === 'CHANNEL_ERROR')) {
          clearTimeout(timeout);
          resolve(next);
        } else if (next === 'CHANNEL_ERROR' || next === 'TIMED_OUT' || next === 'CLOSED') {
          clearTimeout(timeout);
          reject(new Error('Local Realtime subscription failed: ' + next));
        }
      });
  });
  return { channel, messages, status };
}
async function create(name = '두부') {
  const result = await group.owner.client.rpc('create_ingredient', {
    target_fridge_id: group.fridgeId,
    input: { requestId: randomUUID(), name, storage: 'fridge', expiresOn: '2028-11-01' },
  });
  expect(result.error).toBeNull();
  return result.data!;
}
it('real_private_broadcasts_cover_insert_update_delete_membership_and_reconnection', async () => {
  const owner = await listen(group.owner),
    member = await listen(group.member);
  const outsider = await listen(group.outsider, group.fridgeId, true);
  expect(outsider.status).toBe('CHANNEL_ERROR');
  // Realtime's SUBSCRIBED confirms the channel join; wait for replication readiness on old local versions.
  const row = await create();
  await vi.waitFor(
    () => {
      expect(owner.messages.length).toBeGreaterThanOrEqual(1);
      expect(member.messages.length).toBeGreaterThanOrEqual(1);
    },
    { timeout: 8000 },
  );
  expect(outsider.messages).toHaveLength(0);
  const count = member.messages.length;
  const edited = await group.owner.client.rpc('update_ingredient', {
    target_fridge_id: group.fridgeId,
    ingredient_id: row.id,
    expected_version: row.version,
    patch: { remainingPercent: 50 },
  });
  expect(edited.error).toBeNull();
  await vi.waitFor(() => expect(member.messages.length).toBeGreaterThan(count), { timeout: 5000 });
  const beforeDelete = member.messages.length;
  const removed = await group.owner.client.rpc('delete_ingredient', {
    target_fridge_id: group.fridgeId,
    ingredient_id: row.id,
    expected_version: edited.data!.version,
  });
  expect(removed.error).toBeNull();
  await vi.waitFor(() => expect(member.messages.length).toBeGreaterThan(beforeDelete), {
    timeout: 5000,
  });
  for (const message of member.messages) {
    expect(message.event).toBe('inventory_changed');
    // realtime.send may add its own random message ID; no application row data is sent.
    const payload = message.payload as Record<string, unknown>;
    expect(Object.keys(payload).filter((key) => key !== 'id')).toEqual([]);
    if (payload.id !== undefined) {
      expect(payload.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(payload.id).not.toBe(row.id);
    }
  }
  const beforeMembership = owner.messages.length;
  const memberBeforeMembership = member.messages.length;
  const removal = await localAdmin()
    .from('fridge_members')
    .delete()
    .eq('fridge_id', group.fridgeId)
    .eq('user_id', group.member.userId);
  expect(removal.error).toBeNull();
  await vi.waitFor(() => expect(owner.messages.length).toBeGreaterThan(beforeMembership), {
    timeout: 5000,
  });
  await vi.waitFor(() => expect(member.messages.length).toBeGreaterThan(memberBeforeMembership), {
    timeout: 5000,
  });
  const afterRemoval = await create('새 재료');
  const rows = await group.member.client
    .from('ingredients')
    .select('id')
    .eq('fridge_id', group.fridgeId);
  expect(rows.error).toBeNull();
  expect(rows.data).toEqual([]);
  expect(afterRemoval.id).toBeTruthy();
  await group.member.client.removeChannel(member.channel);
  const denied = await listen(group.member, group.fridgeId, true);
  expect(denied.status).toBe('CHANNEL_ERROR');
  await group.owner.client.removeChannel(owner.channel);
  const reconnected = await listen(group.owner);
  await create('재연결 뒤 당근');
  await vi.waitFor(() => expect(reconnected.messages.length).toBeGreaterThan(0), { timeout: 5000 });
  expect(outsider.messages).toHaveLength(0);
}, 45000);
