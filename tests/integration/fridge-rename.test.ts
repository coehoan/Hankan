import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import type { Database } from '../../src/lib/supabase/database.types';
import { seedTestGroup, cleanupTestGroup, localAdmin, type GroupFixture } from '../support/db';
import { renameFridge } from '../../src/features/shell/service';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
let group: GroupFixture, activeClient: SupabaseClient<Database>;
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => activeClient }));
beforeAll(async () => {
  group = await seedTestGroup();
});
afterAll(async () => {
  if (group) await cleanupTestGroup(group);
});
it('member_and_owner_can_rename_shared_fridge_without_changing_ownership', async () => {
  activeClient = group.member.client;
  expect(await renameFridge(group.fridgeId, '  같이 쓰는 냉장고  ')).toEqual({
    id: group.fridgeId,
    name: '같이 쓰는 냉장고',
  });
  expect(
    (
      await group.owner.client
        .from('fridges')
        .select('name,owner_user_id')
        .eq('id', group.fridgeId)
        .single()
    ).data,
  ).toEqual({ name: '같이 쓰는 냉장고', owner_user_id: group.owner.userId });
  activeClient = group.owner.client;
  await renameFridge(group.fridgeId, '우리집');
  expect(
    (await group.member.client.from('fridges').select('name').eq('id', group.fridgeId).single())
      .data?.name,
  ).toBe('우리집');
});
it('outsider_and_revoked_member_cannot_rename', async () => {
  activeClient = group.outsider.client;
  await expect(renameFridge(group.fridgeId, '외부 변경')).rejects.toMatchObject({
    code: 'forbidden',
  });
  await localAdmin()
    .from('fridge_members')
    .delete()
    .eq('fridge_id', group.fridgeId)
    .eq('user_id', group.member.userId);
  activeClient = group.member.client;
  try {
    await expect(renameFridge(group.fridgeId, '탈퇴 후 변경')).rejects.toMatchObject({
      code: 'forbidden',
    });
  } finally {
    await localAdmin()
      .from('fridge_members')
      .insert({ fridge_id: group.fridgeId, user_id: group.member.userId, role: 'member' });
  }
  expect(
    (await localAdmin().from('fridges').select('name').eq('id', group.fridgeId).single()).data
      ?.name,
  ).toBe('우리집');
});
it.each(['   ', '가'.repeat(81), '이름\n변경'])(
  'invalid_fridge_name_does_not_mutate: %s',
  async (name) => {
    activeClient = group.owner.client;
    await expect(renameFridge(group.fridgeId, name)).rejects.toMatchObject({ code: 'validation' });
    expect(
      (await localAdmin().from('fridges').select('name').eq('id', group.fridgeId).single()).data
        ?.name,
    ).toBe('우리집');
  },
);

it('member_removal_and_rename_do_not_deadlock_or_restore_removed_access', async () => {
  // Hold the same fridge-first lock used by removal, then start the competing rename.
  const args = [
    'exec',
    '-i',
    'supabase_db_hankan',
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-At',
    '-v',
    'ON_ERROR_STOP=1',
  ];
  const transaction = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '',
    errors = '';
  transaction.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  transaction.stderr.on('data', (chunk) => {
    errors += chunk.toString();
  });
  const finished = once(transaction, 'close');
  let committed = false;
  try {
    transaction.stdin.write(
      `begin;select id from public.fridges where id='${group.fridgeId}' for update;\n\\echo FRIDGE_LOCKED\n`,
    );
    await vi.waitFor(() => expect(output).toContain('FRIDGE_LOCKED'));
    const rename = group.member.client
      .rpc('rename_fridge', { target_fridge_id: group.fridgeId, fridge_name: '삭제와 동시에 변경' })
      .then((result) => result);
    await vi.waitFor(
      () => {
        const waiting = execFileSync(
          'docker',
          [
            ...args.slice(0, 1),
            ...args.slice(2),
            '-c',
            "select count(*) from pg_stat_activity where wait_event_type='Lock' and query like '%rename_fridge%';",
          ],
          { encoding: 'utf8' },
        ).trim();
        expect(Number(waiting)).toBeGreaterThan(0);
      },
      { timeout: 5000, interval: 100 },
    );
    transaction.stdin.end(
      `delete from public.fridge_members where fridge_id='${group.fridgeId}' and user_id='${group.member.userId}';commit;\n`,
    );
    committed = true;
    const [exit] = await finished,
      result = await rename;
    expect(errors).not.toContain('deadlock');
    expect(exit).toBe(0);
    expect(result.error?.code).toBe('42501');
    expect(
      (
        await localAdmin()
          .from('fridge_members')
          .select('user_id')
          .eq('fridge_id', group.fridgeId)
          .eq('user_id', group.member.userId)
      ).data,
    ).toEqual([]);
  } finally {
    if (!committed) {
      transaction.stdin.end('rollback;\n');
      await finished;
    }
    await localAdmin()
      .from('fridge_members')
      .upsert({ fridge_id: group.fridgeId, user_id: group.member.userId, role: 'member' });
  }
}, 15000);
