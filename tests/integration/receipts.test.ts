import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { Database } from '../../src/lib/supabase/database.types';
import { cleanupTestGroup, localAdmin, seedTestGroup, type GroupFixture } from '../support/db';
import {
  createReceiptDraft,
  analyzeReceipt,
  commitReceipt,
  getReceiptDraft,
  cancelReceipt,
  cleanupReceipts,
  saveReceiptReview,
} from '../../src/features/receipts/service';
import { verifyReceiptImage } from '../../src/features/receipts/image';
let activeClient: SupabaseClient<Database>, group: GroupFixture;
let fail = false,
  failRemoval = false;
let gate: Promise<void> | null = null;
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => Promise.resolve(activeClient),
}));
vi.mock('@/features/ai/registry', () => ({
  getAiProvider: () => ({
    extractReceipt: async () => {
      if (gate) await gate;
      if (fail) throw new Error('provider private failure');
      return [{ id: 'one', rawText: '두부 1', suggestedName: '두부', needsReview: false }];
    },
  }),
}));
vi.mock('@/lib/supabase/admin', async (original) => {
  const actual = await original<typeof import('../../src/lib/supabase/admin')>();
  return {
    createAdminSupabaseClient: () => {
      const client = actual.createAdminSupabaseClient();
      if (failRemoval) {
        const from = client.storage.from.bind(client.storage);
        vi.spyOn(client.storage, 'from').mockImplementation((name) => {
          const storage = from(name);
          vi.spyOn(storage, 'remove').mockResolvedValue({
            data: null,
            error: new Error('temporary storage failure'),
          } as never);
          return storage;
        });
      }
      return client;
    },
  };
});
const items = [{ name: '두부', storage: 'fridge' as const, expiresOn: '2026-11-05' }];
async function make() {
  activeClient = group.member.client;
  const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } })
    .png()
    .toBuffer();
  return createReceiptDraft(
    { userId: group.member.userId, fridgeId: group.fridgeId, role: 'member' },
    await verifyReceiptImage(bytes, 'image/png'),
  );
}
beforeAll(async () => {
  group = await seedTestGroup();
});
afterAll(async () => {
  if (group) {
    activeClient = group.member.client;
    const rows = await localAdmin()
      .from('receipt_drafts')
      .select('id')
      .eq('user_id', group.member.userId);
    for (const row of rows.data ?? []) await cancelReceipt(row.id);
    await cleanupReceipts();
    await cleanupTestGroup(group);
  }
});
it('analysis_does_not_insert_inventory', async () => {
  const draft = await make();
  const before = await group.member.client
    .from('ingredients')
    .select('id')
    .eq('fridge_id', group.fridgeId);
  expect(await analyzeReceipt(draft.draftId)).toHaveLength(1);
  expect(
    (await group.member.client.from('ingredients').select('id').eq('fridge_id', group.fridgeId))
      .data,
  ).toEqual(before.data);
});
it('commit_retries_do_not_duplicate', async () => {
  const draft = await make();
  await analyzeReceipt(draft.draftId);
  const request = randomUUID();
  const [a, b] = await Promise.all([
    commitReceipt(draft.draftId, request, items),
    commitReceipt(draft.draftId, request, items),
  ]);
  expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
  expect(a).toHaveLength(1);
  await expect(commitReceipt(draft.draftId, randomUUID(), items)).rejects.toMatchObject({
    code: 'conflict',
  });
});
it('other_member_cannot_read_original', async () => {
  const draft = await make();
  activeClient = group.owner.client;
  await expect(getReceiptDraft(draft.draftId)).rejects.toMatchObject({ code: 'not_found' });
  expect(
    (await group.owner.client.from('receipt_drafts').select('id').eq('id', draft.draftId)).data,
  ).toEqual([]);
  const direct = await group.owner.client.storage
    .from('receipt-originals')
    .download(group.member.userId + '/' + draft.draftId + '/original.png');
  expect(direct.error).toBeTruthy();
});
it('revoked_member_cannot_commit_or_resume_draft', async () => {
  const draft = await make();
  await localAdmin()
    .from('fridge_members')
    .delete()
    .eq('fridge_id', group.fridgeId)
    .eq('user_id', group.member.userId);
  try {
    await expect(getReceiptDraft(draft.draftId)).rejects.toMatchObject({ code: 'not_found' });
    await expect(commitReceipt(draft.draftId, randomUUID(), items)).rejects.toBeTruthy();
    await expect(analyzeReceipt(draft.draftId)).rejects.toBeTruthy();
    await cancelReceipt(draft.draftId);
  } finally {
    await localAdmin()
      .from('fridge_members')
      .insert({ fridge_id: group.fridgeId, user_id: group.member.userId, role: 'member' });
  }
});
it('invalid_dates_and_partial_analysis_failure_do_not_change_inventory', async () => {
  const draft = await make();
  fail = true;
  await expect(analyzeReceipt(draft.draftId)).rejects.toMatchObject({ code: 'provider_failed' });
  fail = false;
  expect((await getReceiptDraft(draft.draftId)).status).toBe('failed');
  await expect(
    commitReceipt(draft.draftId, randomUUID(), [{ ...items[0], expiresOn: '2026-02-30' }]),
  ).rejects.toMatchObject({ code: 'validation' });
  expect((await getReceiptDraft(draft.draftId)).status).toBe('failed');
});
it('rejects_forged_oversized_and_corrupt_images', async () => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } })
    .png()
    .toBuffer();
  await expect(verifyReceiptImage(png, 'image/jpeg')).rejects.toMatchObject({ code: 'validation' });
  await expect(
    verifyReceiptImage(new Uint8Array(10 * 1024 * 1024 + 1), 'image/png'),
  ).rejects.toMatchObject({ code: 'validation' });
  await expect(verifyReceiptImage(png.subarray(0, 35), 'image/png')).rejects.toMatchObject({
    code: 'validation',
  });
});
it('revocation_cancels_and_queues_the_uploaders_private_draft', async () => {
  const draft = await make();
  await localAdmin()
    .from('fridge_members')
    .delete()
    .eq('fridge_id', group.fridgeId)
    .eq('user_id', group.member.userId);
  try {
    const row = (
      await localAdmin()
        .from('receipt_drafts')
        .select('status,cleanup_pending')
        .eq('id', draft.draftId)
        .single()
    ).data;
    expect(row).toEqual({ status: 'cancelled', cleanup_pending: true });
  } finally {
    await localAdmin()
      .from('fridge_members')
      .insert({ fridge_id: group.fridgeId, user_id: group.member.userId, role: 'member' });
  }
});
it('persists_unfinished_review_without_inserting_inventory', async () => {
  const draft = await make();
  const rows = [
    {
      id: 'one',
      name: '내가 고친 두부',
      storage: 'fridge' as const,
      expiresOn: '',
      included: true,
      rawText: '두부',
      needsReview: false,
    },
  ];
  await saveReceiptReview(draft.draftId, rows);
  expect((await getReceiptDraft(draft.draftId)).reviewItems).toEqual(rows);
});
it('expires_abandoned_drafts_and_removes_their_originals', async () => {
  const draft = await make();
  await localAdmin()
    .from('receipt_drafts')
    .update({ expires_at: '2000-01-01T00:00:00Z' })
    .eq('id', draft.draftId);
  await cleanupReceipts();
  expect(
    (
      await localAdmin()
        .from('receipt_drafts')
        .select('status,cleanup_pending')
        .eq('id', draft.draftId)
        .single()
    ).data,
  ).toEqual({ status: 'cancelled', cleanup_pending: false });
  expect(
    (
      await localAdmin()
        .storage.from('receipt-originals')
        .download(group.member.userId + '/' + draft.draftId + '/original.png')
    ).error,
  ).toBeTruthy();
});
it('deletion_failure_is_retried_without_rolling_back_saved_ingredients', async () => {
  const draft = await make();
  failRemoval = true;
  try {
    expect(await commitReceipt(draft.draftId, randomUUID(), items)).toHaveLength(1);
    expect(
      (
        await localAdmin()
          .from('receipt_drafts')
          .select('status,cleanup_pending')
          .eq('id', draft.draftId)
          .single()
      ).data,
    ).toEqual({ status: 'saved', cleanup_pending: true });
  } finally {
    failRemoval = false;
  }
  await cleanupReceipts();
  expect(
    (
      await localAdmin()
        .from('receipt_drafts')
        .select('cleanup_pending')
        .eq('id', draft.draftId)
        .single()
    ).data?.cleanup_pending,
  ).toBe(false);
});
it('duplicate_analysis_has_one_active_claim', async () => {
  const draft = await make();
  let release!: () => void;
  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = analyzeReceipt(draft.draftId);
  try {
    await vi.waitFor(async () =>
      expect(
        (
          await localAdmin()
            .from('receipt_drafts')
            .select('status')
            .eq('id', draft.draftId)
            .single()
        ).data?.status,
      ).toBe('analyzing'),
    );
    await expect(analyzeReceipt(draft.draftId)).rejects.toMatchObject({ code: 'conflict' });
  } finally {
    release();
    gate = null;
  }
  expect(await first).toHaveLength(1);
});
it('direct_rpc_invalid_second_item_rolls_back_the_whole_batch', async () => {
  const draft = await make();
  const before = (
    await group.member.client.from('ingredients').select('id').eq('fridge_id', group.fridgeId)
  ).data;
  const result = await group.member.client.rpc('commit_receipt', {
    draft_id: draft.draftId,
    commit_request: randomUUID(),
    confirmed_items: [items[0], { ...items[0], expiresOn: '2026-02-30' }],
  });
  expect(result.error).toBeTruthy();
  expect(
    (await group.member.client.from('ingredients').select('id').eq('fridge_id', group.fridgeId))
      .data,
  ).toEqual(before);
});
async function interruptedAnalysis() {
  const draft = await make(),
    review = [
      {
        id: 'edited',
        name: '저장해 둔 두부',
        storage: 'pantry' as const,
        expiresOn: '',
        included: true,
        rawText: '두부',
        needsReview: false,
      },
    ];
  await saveReceiptReview(draft.draftId, review);
  const started = await group.member.client.rpc('start_receipt_analysis', {
    draft_id: draft.draftId,
  });
  expect(started.error).toBeNull();
  expect(
    (
      await localAdmin()
        .from('receipt_drafts')
        .update({ analysis_started_at: new Date(Date.now() - 301_000).toISOString() })
        .eq('id', draft.draftId)
    ).error,
  ).toBeNull();
  return { draft, review, oldRun: started.data! };
}
it('expired_analysis_recovers_saved_review_and_fences_late_results_before_manual_commit', async () => {
  const { draft, review, oldRun } = await interruptedAnalysis();
  expect(
    (await group.owner.client.rpc('recover_receipt_analysis', { draft_id: draft.draftId })).error
      ?.code,
  ).toBe('P0002');
  const resumed = await getReceiptDraft(draft.draftId);
  expect(resumed.status).toBe('failed');
  expect(resumed.reviewItems).toEqual(review);
  const late = await localAdmin().rpc('finish_receipt_analysis', {
    draft_id: draft.draftId,
    run_id: oldRun,
    extracted: [{ id: 'late', rawText: 'late', suggestedName: '늦은 결과', needsReview: false }],
    succeeded: true,
  });
  expect(late.error).toBeNull();
  expect(late.data).toBe(false);
  expect((await getReceiptDraft(draft.draftId)).reviewItems).toEqual(review);
  await saveReceiptReview(draft.draftId, [{ ...review[0], expiresOn: '2026-11-05' }]);
  expect(await commitReceipt(draft.draftId, randomUUID(), items)).toHaveLength(1);
});
it('expired_analysis_can_retry_while_a_fresh_analysis_is_not_cancelled_by_a_read', async () => {
  const { draft, oldRun } = await interruptedAnalysis();
  expect((await getReceiptDraft(draft.draftId)).status).toBe('failed');
  expect(await analyzeReceipt(draft.draftId)).toHaveLength(1);
  expect(
    (
      await localAdmin().rpc('finish_receipt_analysis', {
        draft_id: draft.draftId,
        run_id: oldRun,
        extracted: [],
        succeeded: false,
      })
    ).data,
  ).toBe(false);
  const fresh = await make(),
    active = await group.member.client.rpc('start_receipt_analysis', { draft_id: fresh.draftId });
  expect(active.error).toBeNull();
  expect((await getReceiptDraft(fresh.draftId)).status).toBe('analyzing');
  expect(
    (
      await localAdmin().rpc('finish_receipt_analysis', {
        draft_id: fresh.draftId,
        run_id: active.data!,
        extracted: [],
        succeeded: true,
      })
    ).data,
  ).toBe(true);
});
