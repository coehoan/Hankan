import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { Database } from '../../src/lib/supabase/database.types';
import { seedTestGroup, cleanupTestGroup, localAdmin, type GroupFixture } from '../support/db';
import {
  prepareReceiptUpload,
  completeReceiptUpload,
} from '../../src/features/receipts/direct-upload';
import { cancelReceipt, commitReceipt } from '../../src/features/receipts/service';
import { cleanupReceiptFiles } from '../../src/jobs/worker';
import { cleanupStagedUploads } from '../../src/jobs/staging-cleanup';
let group: GroupFixture, activeClient: SupabaseClient<Database>, png: Buffer;
let failStagedRemoval = false,
  canonicalGate: Promise<void> | null = null;
const paths: string[] = [],
  draftIds: string[] = [];
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => activeClient }));
vi.mock('@/lib/supabase/admin', async (original) => {
  const actual = await original<typeof import('../../src/lib/supabase/admin')>();
  return {
    createAdminSupabaseClient: () => {
      const client = actual.createAdminSupabaseClient(),
        from = client.storage.from.bind(client.storage);
      vi.spyOn(client.storage, 'from').mockImplementation((name) => {
        const storage = from(name);
        if (name === 'receipt-uploads' && failStagedRemoval)
          vi.spyOn(storage, 'remove').mockResolvedValue({
            data: null,
            error: new Error('temporary fixture outage'),
          } as never);
        if (name === 'receipt-originals' && canonicalGate) {
          const gate = canonicalGate,
            upload = storage.upload.bind(storage);
          vi.spyOn(storage, 'upload').mockImplementation(
            async (...args: Parameters<typeof upload>) => {
              await gate;
              return upload(...args);
            },
          );
        }
        return storage;
      });
      return client;
    },
  };
});
beforeAll(async () => {
  group = await seedTestGroup();
  activeClient = group.member.client;
  png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } })
    .png()
    .toBuffer();
});
afterAll(async () => {
  if (!group) return;
  failStagedRemoval = false;
  activeClient = group.member.client;
  for (const id of draftIds) await cancelReceipt(id);
  await cleanupReceiptFiles(new Date().toISOString());
  if (paths.length) await localAdmin().storage.from('receipt-uploads').remove(paths);
  await cleanupTestGroup(group);
});
async function make() {
  activeClient = group.member.client;
  const prepared = await prepareReceiptUpload(group.fridgeId, 'image/png', png.length);
  paths.push(prepared.objectPath);
  await put(prepared.uploadUrl);
  const draft = await completeReceiptUpload(group.fridgeId, prepared.objectPath);
  draftIds.push(draft.draftId);
  return { ...prepared, ...draft };
}
async function put(url: string) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png', 'x-upsert': 'false' },
    body: new Uint8Array(png),
  });
  expect(response.ok).toBe(true);
}
async function stagedExists(path: string) {
  return !(await localAdmin().storage.from('receipt-uploads').download(path)).error;
}
it('cancelling_immediately_removes_both_files_and_preserves_other_private_uploads', async () => {
  const draft = await make(),
    other = await make();
  const canonical = (
    await activeClient.from('receipt_drafts').select('object_path').eq('id', draft.draftId).single()
  ).data!.object_path;
  activeClient = group.owner.client;
  await expect(cancelReceipt(draft.draftId)).rejects.toBeTruthy();
  expect(await stagedExists(draft.objectPath)).toBe(true);
  activeClient = group.member.client;
  await cancelReceipt(draft.draftId);
  expect(await stagedExists(draft.objectPath)).toBe(false);
  expect(
    (await localAdmin().storage.from('receipt-originals').download(canonical)).error,
  ).toBeTruthy();
  expect(await stagedExists(other.objectPath)).toBe(true);
});
it('confirmed_save_immediately_deletes_staging_without_duplicating_inventory_on_retry', async () => {
  const draft = await make(),
    run = await activeClient.rpc('start_receipt_analysis', { draft_id: draft.draftId });
  expect(run.error).toBeNull();
  expect(
    (
      await localAdmin().rpc('finish_receipt_analysis', {
        draft_id: draft.draftId,
        run_id: run.data!,
        extracted: [],
        succeeded: true,
      })
    ).error,
  ).toBeNull();
  const requestId = randomUUID(),
    items = [{ name: '두부', storage: 'fridge' as const, expiresOn: '2026-11-30' }];
  const first = await commitReceipt(draft.draftId, requestId, items);
  expect(await stagedExists(draft.objectPath)).toBe(false);
  expect((await commitReceipt(draft.draftId, requestId, items))[0].id).toBe(first[0].id);
});
it('staging_delete_failure_keeps_retry_marker_until_worker_deletes_both', async () => {
  const draft = await make();
  failStagedRemoval = true;
  try {
    await cancelReceipt(draft.draftId);
  } finally {
    failStagedRemoval = false;
  }
  expect(
    (
      await localAdmin()
        .from('receipt_drafts')
        .select('cleanup_pending')
        .eq('id', draft.draftId)
        .single()
    ).data?.cleanup_pending,
  ).toBe(true);
  expect(await stagedExists(draft.objectPath)).toBe(true);
  await cleanupReceiptFiles(new Date().toISOString());
  expect(await stagedExists(draft.objectPath)).toBe(false);
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
it('replayed_upload_capability_after_cancellation_is_removed_on_next_worker_cycle', async () => {
  const draft = await make();
  await cancelReceipt(draft.draftId);
  await put(draft.uploadUrl);
  expect(await stagedExists(draft.objectPath)).toBe(true);
  await cleanupStagedUploads(new Date().toISOString());
  expect(await stagedExists(draft.objectPath)).toBe(false);
});
it('cancellation_during_upload_cannot_leave_a_late_original_behind', async () => {
  activeClient = group.member.client;
  const prepared = await prepareReceiptUpload(group.fridgeId, 'image/png', png.length);
  paths.push(prepared.objectPath);
  await put(prepared.uploadUrl);
  let release!: () => void;
  canonicalGate = new Promise((resolve) => {
    release = resolve;
  });
  const completion = completeReceiptUpload(group.fridgeId, prepared.objectPath).then(
    (value) => ({ value, error: null }),
    (error) => ({ value: null, error }),
  );
  let row: { id: string; object_path: string } | undefined;
  try {
    await vi.waitFor(
      async () => {
        const found = await localAdmin()
          .from('receipt_drafts')
          .select('id,object_path')
          .eq('staged_object_path', prepared.objectPath)
          .maybeSingle();
        expect(found.data).toBeTruthy();
        row = found.data!;
      },
      { timeout: 5000 },
    );
    draftIds.push(row!.id);
    await cancelReceipt(row!.id);
  } finally {
    canonicalGate = null;
    release();
  }
  const result = await completion;
  expect(result.error).toMatchObject({ code: 'conflict' });
  expect(
    (await localAdmin().storage.from('receipt-originals').download(row!.object_path)).error,
  ).toBeTruthy();
  expect(await stagedExists(prepared.objectPath)).toBe(false);
});
it('cancellation_after_draft_creation_before_rpc_return_already_has_the_staging_link', async () => {
  activeClient = group.member.client;
  const prepared = await prepareReceiptUpload(group.fridgeId, 'image/png', png.length);
  paths.push(prepared.objectPath);
  await put(prepared.uploadUrl);
  let release!: () => void, createdId: string | undefined;
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    rpc = activeClient.rpc.bind(activeClient);
  const spy = vi.spyOn(activeClient, 'rpc').mockImplementation((async (
    ...args: Parameters<typeof rpc>
  ) => {
    const result = await rpc(...args);
    if (args[0] === 'create_receipt_draft' && result.data) {
      createdId = (result.data as { id: string }).id;
      await gate;
    }
    return result;
  }) as never);
  const completion = completeReceiptUpload(group.fridgeId, prepared.objectPath).then(
    (value) => ({ value, error: null }),
    (error) => ({ value: null, error }),
  );
  try {
    await vi.waitFor(() => expect(createdId).toBeTruthy(), { timeout: 5000 });
    draftIds.push(createdId!);
    await cancelReceipt(createdId!);
    expect(await stagedExists(prepared.objectPath)).toBe(false);
  } finally {
    release();
    await completion;
    spy.mockRestore();
  }
});
it('replay_cleanup_visits_terminal_links_beyond_the_first_hundred', async () => {
  activeClient = group.member.client;
  const prepared = await prepareReceiptUpload(group.fridgeId, 'image/png', png.length);
  paths.push(prepared.objectPath);
  await put(prepared.uploadUrl);
  const ids = Array.from({ length: 101 }, () => randomUUID()).sort(),
    stamp = Date.now();
  const rows = ids.map((id, i) => ({
    id,
    user_id: group.member.userId,
    fridge_id: group.fridgeId,
    object_path: group.member.userId + '/' + id + '/original.png',
    status: 'cancelled',
    staged_object_path:
      i === 100
        ? prepared.objectPath
        : group.member.userId + '_' + group.fridgeId + '_' + randomUUID(),
    created_at: new Date(stamp + i).toISOString(),
  }));
  expect((await localAdmin().from('receipt_drafts').insert(rows)).error).toBeNull();
  await cleanupStagedUploads(new Date(stamp + 1000).toISOString());
  expect(await stagedExists(prepared.objectPath)).toBe(false);
});
it('atomic_staging_link_rejects_other_users_paths_and_rolls_back_creation', async () => {
  activeClient = group.member.client;
  const id = randomUUID();
  const forged = group.owner.userId + '_' + group.fridgeId + '_' + randomUUID();
  const result = await activeClient.rpc('create_receipt_draft', {
    draft_id: id,
    target_fridge_id: group.fridgeId,
    staged_upload_path: forged,
  });
  expect(result.error?.code).toBe('23514');
  expect(
    (await localAdmin().from('receipt_drafts').select('id').eq('id', id).maybeSingle()).data,
  ).toBeNull();
});
