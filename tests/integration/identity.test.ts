import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupTestGroup, localAdmin, seedTestGroup, type GroupFixture } from '../support/db';

describe('real local identity and data access', () => {
  let fixture: GroupFixture | undefined;
  beforeEach(async () => {
    fixture = await seedTestGroup();
  });
  afterEach(async () => {
    if (fixture) await cleanupTestGroup(fixture);
    fixture = undefined;
  });

  it('signup_creates_exactly_one_owned_fridge_and_selection', async () => {
    const { owner, fridgeId } = fixture!;
    const fridges = await owner.client
      .from('fridges')
      .select('id')
      .eq('owner_user_id', owner.userId);
    expect(fridges.error).toBeNull();
    expect(fridges.data).toEqual([{ id: fridgeId }]);
    const profile = await owner.client
      .from('profiles')
      .select('last_fridge_id')
      .eq('user_id', owner.userId)
      .single();
    expect(profile.data?.last_fridge_id).toBe(fridgeId);
    const membership = await owner.client
      .from('fridge_members')
      .select('role')
      .eq('fridge_id', fridgeId)
      .eq('user_id', owner.userId)
      .single();
    expect(membership.data?.role).toBe('owner');
  });

  it('outsider_cannot_read_another_fridge_or_profile', async () => {
    const { owner, outsider, fridgeId } = fixture!;
    const fridges = await outsider.client.from('fridges').select('id').eq('id', fridgeId);
    expect(fridges.error).toBeNull();
    expect(fridges.data).toEqual([]);
    const profiles = await outsider.client
      .from('profiles')
      .select('user_id')
      .eq('user_id', owner.userId);
    expect(profiles.data).toEqual([]);
  });

  it('member_can_read_the_same_fridge_without_recursive_policies', async () => {
    const { member, fridgeId } = fixture!;
    const fridge = await member.client.from('fridges').select('id').eq('id', fridgeId).single();
    expect(fridge.error).toBeNull();
    expect(fridge.data?.id).toBe(fridgeId);
    const members = await member.client
      .from('fridge_members')
      .select('user_id')
      .eq('fridge_id', fridgeId);
    expect(members.error).toBeNull();
    expect(members.data).toHaveLength(2);
  });

  it('member_cannot_promote_self_using_the_public_api', async () => {
    const { member, fridgeId } = fixture!;
    const change = await member.client
      .from('fridge_members')
      .update({ role: 'owner' })
      .eq('fridge_id', fridgeId)
      .eq('user_id', member.userId);
    expect(change.error?.code).toBe('42501');
    const membership = await member.client
      .from('fridge_members')
      .select('role')
      .eq('fridge_id', fridgeId)
      .eq('user_id', member.userId)
      .single();
    expect(membership.data?.role).toBe('member');
  });

  it('private_settings_do_not_grant_access_to_another_fridge', async () => {
    const { member, outsider } = fixture!;
    const outsidersFridge = await outsider.client
      .from('fridges')
      .select('id')
      .eq('owner_user_id', outsider.userId)
      .single();
    const invalidSelection = await member.client
      .from('profiles')
      .update({ last_fridge_id: outsidersFridge.data!.id })
      .eq('user_id', member.userId);
    expect(invalidSelection.error?.code).toBe('42501');
    const ownTheme = await member.client
      .from('profiles')
      .update({ theme_preference: 'dark' })
      .eq('user_id', member.userId)
      .select('theme_preference')
      .single();
    expect(ownTheme.data?.theme_preference).toBe('dark');
  });

  it('revoked_member_loses_group_access_but_keeps_personal_fridge', async () => {
    const { owner, member, fridgeId } = fixture!;
    const removed = await localAdmin()
      .from('fridge_members')
      .delete()
      .eq('fridge_id', fridgeId)
      .eq('user_id', member.userId);
    expect(removed.error).toBeNull();
    const inaccessible = await member.client.from('fridges').select('id').eq('id', fridgeId);
    expect(inaccessible.data).toEqual([]);
    const own = await member.client.from('fridges').select('id').eq('owner_user_id', member.userId);
    expect(own.data).toHaveLength(1);
    const retained = await owner.client.from('fridges').select('id').eq('id', fridgeId).single();
    expect(retained.data?.id).toBe(fridgeId);
  });
});
