import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../src/lib/supabase/database.types';
import type { AccessContext } from '../../src/lib/contracts';
import { cleanupTestGroup, localAdmin, seedTestGroup, type GroupFixture } from '../support/db';
import {
  acceptInvite,
  createInvite,
  inspectInvite,
  leaveFridge,
  listMembers,
  removeMember,
  revokeInvite,
} from '../../src/features/sharing/service';
import {
  POST as createRoute,
  DELETE as cancelRoute,
} from '../../src/app/api/fridges/[fridgeId]/invites/route';
import { GET as inspectRoute, POST as acceptRoute } from '../../src/app/api/invites/[token]/route';
import { DELETE as memberRoute } from '../../src/app/api/fridges/[fridgeId]/members/[userId]/route';
let client: SupabaseClient<Database>;
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => Promise.resolve(client),
}));
describe('real single-use invitations and memberships', () => {
  let group: GroupFixture;
  beforeAll(async () => {
    group = await seedTestGroup();
  });
  afterAll(async () => {
    if (group) await cleanupTestGroup(group);
  });
  beforeEach(async () => {
    client = group.owner.client;
    expect(
      (await localAdmin().from('fridge_invites').delete().eq('fridge_id', group.fridgeId)).error,
    ).toBeNull();
    await localAdmin()
      .from('fridge_members')
      .delete()
      .eq('fridge_id', group.fridgeId)
      .eq('user_id', group.outsider.userId);
    await localAdmin()
      .from('fridge_members')
      .upsert({ fridge_id: group.fridgeId, user_id: group.member.userId, role: 'member' });
  });
  const access = (userId: string, role: 'owner' | 'member' = 'owner'): AccessContext => ({
    userId,
    fridgeId: group.fridgeId,
    role,
  });
  async function invite() {
    client = group.owner.client;
    return createInvite(access(group.owner.userId));
  }
  const request = (
    method: string,
    body: unknown = {},
    origin = process.env.NEXT_PUBLIC_SITE_URL!,
  ) =>
    new Request(process.env.NEXT_PUBLIC_SITE_URL!, {
      method,
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
    });
  const context = () => ({ params: Promise.resolve({ fridgeId: group.fridgeId }) });
  it('HTTP_invite_creation_checks_ownership_origin_and_JSON', async () => {
    const response = await createRoute(request('POST'), context());
    expect(response.status).toBe(201);
    const created = (await response.json()).data;
    expect(created.token.length).toBe(43);
    expect(
      (await createRoute(request('POST', {}, 'https://foreign.invalid'), context())).status,
    ).toBe(403);
    client = group.member.client;
    expect((await createRoute(request('POST'), context())).status).toBe(403);
    expect(
      (await cancelRoute(request('DELETE', { inviteId: created.inviteId }), context())).status,
    ).toBe(403);
    expect(
      (
        await memberRoute(request('DELETE'), {
          params: Promise.resolve({ fridgeId: group.fridgeId, userId: group.owner.userId }),
        })
      ).status,
    ).toBe(403);
  });
  it('HTTP_inspection_never_joins_and_explicit_accept_and_leave_are_checked', async () => {
    const created = await invite();
    client = group.outsider.client;
    const tokenContext = { params: Promise.resolve({ token: created.token }) };
    expect((await inspectRoute(request('GET'), tokenContext)).status).toBe(200);
    expect((await client.from('fridges').select('id').eq('id', group.fridgeId)).data).toEqual([]);
    expect(
      (await acceptRoute(request('POST', {}, 'https://foreign.invalid'), tokenContext)).status,
    ).toBe(403);
    expect((await acceptRoute(request('POST'), tokenContext)).status).toBe(200);
    expect(
      (
        await memberRoute(request('DELETE'), {
          params: Promise.resolve({ fridgeId: group.fridgeId, userId: 'me' }),
        })
      ).status,
    ).toBe(200);
    expect((await acceptRoute(request('POST'), tokenContext)).status).toBe(409);
  });
  it('stores_only_a_hash_and_expires_after_one_day', async () => {
    const created = await invite();
    expect(created.token.length).toBe(43);
    const row = await localAdmin()
      .from('fridge_invites')
      .select('token_hash,created_at,expires_at')
      .eq('id', created.inviteId)
      .single();
    expect(row.error).toBeNull();
    expect(row.data?.token_hash).toBe(createHash('sha256').update(created.token).digest('hex'));
    expect(Date.parse(row.data!.expires_at) - Date.parse(row.data!.created_at)).toBe(86400000);
  });
  it('two_acceptors_use_one_invite_once', async () => {
    const created = await invite();
    await localAdmin()
      .from('fridge_members')
      .delete()
      .eq('fridge_id', group.fridgeId)
      .eq('user_id', group.member.userId);
    const hash = createHash('sha256').update(created.token).digest('hex');
    const results = await Promise.all(
      [group.member, group.outsider].map((identity) =>
        identity.client.rpc('accept_fridge_invite', { token_digest: hash }),
      ),
    );
    expect(results.filter((result) => result.error === null)).toHaveLength(1);
    expect(results.filter((result) => result.error?.code === 'PT409')).toHaveLength(1);
    const members = await group.owner.client
      .from('fridge_members')
      .select('user_id')
      .eq('fridge_id', group.fridgeId);
    expect(members.data).toHaveLength(2);
  });
  it('existing_member_accept_is_idempotent_and_does_not_consume_a_fresh_link', async () => {
    const created = await invite();
    client = group.member.client;
    expect((await inspectInvite(created.token)).state).toBe('already_member');
    expect((await acceptInvite(created.token)).id).toBe(group.fridgeId);
    expect((await acceptInvite(created.token)).id).toBe(group.fridgeId);
    expect(
      (
        await localAdmin()
          .from('fridge_invites')
          .select('used_at')
          .eq('id', created.inviteId)
          .single()
      ).data?.used_at,
    ).toBeNull();
    client = group.outsider.client;
    expect((await acceptInvite(created.token)).id).toBe(group.fridgeId);
  });
  it('member_cannot_invite_revoke_or_remove_and_private_profiles_stay_private', async () => {
    const created = await invite();
    client = group.member.client;
    const context = access(group.member.userId, 'member');
    await expect(createInvite(context)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(revokeInvite(context, created.inviteId)).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(removeMember(context, group.owner.userId)).rejects.toMatchObject({
      code: 'forbidden',
    });
    const members = await listMembers(context);
    expect(members).toHaveLength(2);
    expect(Object.keys(members[0]).sort()).toEqual(['displayName', 'role', 'userId']);
    expect(
      (await client.from('profiles').select('*').eq('user_id', group.owner.userId)).data,
    ).toEqual([]);
    expect((await client.from('fridge_invites').select('id')).data).toEqual([]);
    expect((await group.owner.client.from('fridge_invites').select('token_hash')).error?.code).toBe(
      '42501',
    );
  });
  it('owner_cannot_leave_remove_self_or_accept_own_invite', async () => {
    const created = await invite();
    await expect(leaveFridge(access(group.owner.userId))).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(
      removeMember(access(group.owner.userId), group.owner.userId),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(acceptInvite(created.token)).rejects.toMatchObject({ code: 'forbidden' });
  });
  it.each(['expired', 'revoked', 'used'])('blocks_%s_invites', async (state) => {
    const created = await invite();
    if (state === 'expired')
      await localAdmin()
        .from('fridge_invites')
        .update({ expires_at: '2020-01-01T00:00:00Z' })
        .eq('id', created.inviteId);
    if (state === 'revoked') await revokeInvite(access(group.owner.userId), created.inviteId);
    if (state === 'used') {
      client = group.outsider.client;
      await acceptInvite(created.token);
      await localAdmin()
        .from('fridge_members')
        .delete()
        .eq('fridge_id', group.fridgeId)
        .eq('user_id', group.outsider.userId);
    }
    client = group.outsider.client;
    expect((await inspectInvite(created.token)).state).toBe(state);
    await expect(acceptInvite(created.token)).rejects.toMatchObject({ code: 'conflict' });
  });
  it('joining_does_not_move_or_merge_personal_inventory', async () => {
    const created = await invite();
    client = group.outsider.client;
    const owned = await client
      .from('fridges')
      .select('id')
      .eq('owner_user_id', group.outsider.userId)
      .single();
    const personal = await client.rpc('create_ingredient', {
      target_fridge_id: owned.data!.id,
      input: {
        requestId: crypto.randomUUID(),
        name: '개인 딸기',
        storage: 'fridge',
        expiresOn: '2026-11-01',
      },
    });
    expect(personal.error).toBeNull();
    await acceptInvite(created.token);
    expect(
      (await client.from('ingredients').select('id').eq('id', personal.data!.id).single()).data?.id,
    ).toBe(personal.data!.id);
    expect(
      (await client.from('ingredients').select('id').eq('fridge_id', group.fridgeId)).data,
    ).toEqual([]);
  });
  it('revocation_blocks_next_read_and_write_and_preserves_member_created_ingredients', async () => {
    const item = await group.member.client.rpc('create_ingredient', {
      target_fridge_id: group.fridgeId,
      input: {
        requestId: crypto.randomUUID(),
        name: '멤버가 산 대파',
        storage: 'fridge',
        expiresOn: '2026-11-05',
      },
    });
    expect(item.error).toBeNull();
    await removeMember(access(group.owner.userId), group.member.userId);
    expect(
      (await group.member.client.from('ingredients').select('id').eq('fridge_id', group.fridgeId))
        .data,
    ).toEqual([]);
    expect(
      (
        await group.member.client.rpc('update_ingredient', {
          target_fridge_id: group.fridgeId,
          ingredient_id: item.data!.id,
          expected_version: 1,
          patch: { name: '늦은 수정' },
        })
      ).error?.code,
    ).toBe('42501');
    expect(
      (await group.owner.client.from('ingredients').select('id').eq('id', item.data!.id).single())
        .data?.id,
    ).toBe(item.data!.id);
    await localAdmin().from('ingredients').delete().eq('id', item.data!.id);
  });
  it('member_can_leave_but_cannot_rejoin_a_consumed_link', async () => {
    const created = await invite();
    client = group.outsider.client;
    await acceptInvite(created.token);
    await leaveFridge(access(group.outsider.userId, 'member'));
    await expect(acceptInvite(created.token)).rejects.toMatchObject({ code: 'conflict' });
  });
});
