import { browserSupabaseUrl } from '@/lib/supabase/server-config';
import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireFridgeAccess, requireUser } from '@/lib/auth';
import type { AccessContext } from '@/lib/contracts';
import { AppError } from '@/lib/errors';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type { Tables } from '@/lib/supabase/database.types';
import { checkDatabaseError, toIngredient } from '@/features/inventory/service';
import { parseCreateIngredient, parseId, parseIngredientPatch } from '@/features/inventory/domain';
import type { Ingredient } from '@/features/inventory/contracts';
import { getAiProvider } from '@/features/ai/registry';
import type { ExtractedItem, VerifiedImage } from '@/features/ai/contracts';
import type { ConfirmedItem, ReceiptDraft, ReceiptDraftStatus, ReviewItem } from './contracts';
import { verifyReceiptImage } from './image';
import { removeReceiptFiles } from './file-cleanup';
const bucket = 'receipt-originals';
const reviewSchema = z
  .array(
    z
      .object({
        id: z.string().min(1).max(100),
        name: z.string().refine((value) => [...value].length <= 80),
        storage: z.enum(['fridge', 'freezer', 'pantry']),
        expiresOn: z.string().refine((value) => {
          if (value === '') return true;
          try {
            parseIngredientPatch({ expiresOn: value });
            return true;
          } catch {
            return false;
          }
        }),
        included: z.boolean(),
        rawText: z.string().max(1000),
        needsReview: z.boolean(),
      })
      .strict(),
  )
  .max(100)
  .refine((rows) => new Set(rows.map((row) => row.id)).size === rows.length);
export async function saveReceiptReview(id: string, rows: unknown): Promise<void> {
  const { client, row } = await rawDraft(id);
  const parsed = reviewSchema.safeParse(rows);
  if (!parsed.success) throw new AppError('validation', '임시 저장할 품목을 확인해 주세요.');
  const result = await client.rpc('save_receipt_review', {
    draft_id: row.id,
    review: parsed.data.map((item) => ({ ...item })),
  });
  checkDatabaseError(result.error);
}
const extractedSchema = z
  .array(
    z
      .object({
        id: z.string().min(1).max(100),
        rawText: z.string().max(1000),
        suggestedName: z.string().trim().max(80),
        needsReview: z.boolean(),
      })
      .strict(),
  )
  .max(100)
  .refine((items) => new Set(items.map((item) => item.id)).size === items.length);
function extracted(value: unknown): ExtractedItem[] {
  const result = extractedSchema.safeParse(value);
  if (!result.success)
    throw new AppError(
      'provider_failed',
      '분석한 품목을 확인하지 못했어요. 직접 입력하거나 다시 분석해 주세요.',
    );
  return result.data;
}
async function rawDraft(id: string) {
  await requireUser();
  const client = await createServerSupabaseClient();
  const result = await client
    .from('receipt_drafts')
    .select('*')
    .eq('id', parseId(id))
    .maybeSingle();
  checkDatabaseError(result.error);
  if (!result.data) throw new AppError('not_found', '접근할 수 없거나 만료된 영수증 초안이에요.');
  await requireFridgeAccess(result.data.fridge_id);
  return { client, row: result.data };
}
async function cleanOne(id: string) {
  const admin = createAdminSupabaseClient();
  const found = await admin
    .from('receipt_drafts')
    .select('object_path,staged_object_path,status,cleanup_pending')
    .eq('id', id)
    .single();
  if (found.error || !['saved', 'cancelled'].includes(found.data.status)) return false;
  try {
    await removeReceiptFiles({
      objectPath: found.data.object_path,
      stagedObjectPath: found.data.staged_object_path,
    });
    const update = await admin
      .from('receipt_drafts')
      .update({ cleanup_pending: false })
      .eq('id', id);
    return !update.error;
  } catch {
    return false;
  }
}
export async function createReceiptDraft(
  access: AccessContext,
  image: VerifiedImage,
  stagedObjectPath?: string,
): Promise<{ draftId: string; fridgeId: string; status: ReceiptDraftStatus }> {
  const current = await requireFridgeAccess(parseId(access.fridgeId));
  if (current.userId !== access.userId)
    throw new AppError('forbidden', '냉장고 권한을 다시 확인해 주세요.');
  const verified = await verifyReceiptImage(image.bytes, image.mimeType),
    client = await createServerSupabaseClient(),
    id = randomUUID();
  const result = stagedObjectPath
    ? await client.rpc('create_receipt_draft', {
        draft_id: id,
        target_fridge_id: current.fridgeId,
        staged_upload_path: stagedObjectPath,
      })
    : await client.rpc('create_receipt_draft', {
        draft_id: id,
        target_fridge_id: current.fridgeId,
      });
  checkDatabaseError(result.error);
  if (!result.data) throw new AppError('internal', '초안을 만들지 못했어요.');
  const upload = await createAdminSupabaseClient()
    .storage.from(bucket)
    .upload(result.data.object_path, verified.bytes, {
      contentType: 'image/png',
      upsert: false,
      cacheControl: '0',
    });
  if (upload.error) {
    await client.rpc('cancel_receipt', { draft_id: id });
    throw new AppError('internal', '사진을 보관하지 못했어요. 다시 올려 주세요.');
  }
  try {
    await requireFridgeAccess(current.fridgeId);
    const latest = await client.from('receipt_drafts').select('status').eq('id', id).maybeSingle();
    checkDatabaseError(latest.error);
    if (!latest.data) throw new AppError('not_found', '초안을 찾을 수 없어요.');
    if (['saved', 'cancelled'].includes(latest.data.status)) {
      await cleanOne(id);
      throw new AppError('conflict', '이미 저장하거나 취소한 초안이에요.');
    }
  } catch (error) {
    await cancelReceipt(id).catch(() => {});
    throw error;
  }
  return { draftId: id, fridgeId: current.fridgeId, status: 'uploaded' };
}
export async function getReceiptDraft(id: string): Promise<ReceiptDraft> {
  let { client, row } = await rawDraft(id);
  if (row.status === 'analyzing') {
    const recovered = await client.rpc('recover_receipt_analysis', { draft_id: row.id });
    checkDatabaseError(recovered.error);
    if (recovered.data) ({ client, row } = await rawDraft(id));
  }
  const fridge = await client.from('fridges').select('name').eq('id', row.fridge_id).single();
  checkDatabaseError(fridge.error);
  let originalUrl: string | null = null;
  if (!['saved', 'cancelled'].includes(row.status)) {
    const signed = await createAdminSupabaseClient()
      .storage.from(bucket)
      .createSignedUrl(row.object_path, 60);
    if (signed.error)
      throw new AppError('internal', '사진을 불러오지 못했어요. 다시 시도해 주세요.');
    originalUrl = browserSupabaseUrl(signed.data.signedUrl);
  }
  return {
    draftId: row.id,
    fridgeId: row.fridge_id,
    fridgeName: fridge.data!.name,
    status: row.status as ReceiptDraftStatus,
    items: extracted(row.items),
    reviewItems: row.review_items as ReviewItem[] | null,
    originalUrl,
    expiresAt: row.expires_at,
  };
}
export async function listReceiptDrafts(fridgeId: string) {
  await requireFridgeAccess(parseId(fridgeId));
  const client = await createServerSupabaseClient();
  const result = await client
    .from('receipt_drafts')
    .select('id,status,created_at')
    .eq('fridge_id', fridgeId)
    .not('status', 'in', '(saved,cancelled)')
    .order('created_at', { ascending: false });
  checkDatabaseError(result.error);
  return result.data ?? [];
}
export async function analyzeReceipt(id: string): Promise<ExtractedItem[]> {
  const { client, row } = await rawDraft(id);
  if (row.status === 'ready') return extracted(row.items);
  const provider = getAiProvider();
  const claim = await client.rpc('start_receipt_analysis', { draft_id: row.id });
  checkDatabaseError(claim.error);
  const admin = createAdminSupabaseClient();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const image = await admin.storage.from(bucket).download(row.object_path);
    if (image.error || !image.data) throw new Error('Image unavailable');
    const result = extracted(
      await Promise.race([
        provider.extractReceipt({
          bytes: new Uint8Array(await image.data.arrayBuffer()),
          mimeType: 'image/png',
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Analysis timed out')), 60_000);
        }),
      ]),
    );
    const finished = await admin.rpc('finish_receipt_analysis', {
      draft_id: row.id,
      run_id: claim.data!,
      extracted: result.map((item) => ({ ...item })),
      succeeded: true,
    });
    checkDatabaseError(finished.error);
    if (!finished.data) throw new AppError('forbidden', '초안의 상태나 냉장고 권한이 변경됐어요.');
    return result;
  } catch (error) {
    await admin.rpc('finish_receipt_analysis', {
      draft_id: row.id,
      run_id: claim.data!,
      extracted: [],
      succeeded: false,
    });
    if (error instanceof AppError && error.code === 'forbidden') throw error;
    throw new AppError(
      'provider_failed',
      '영수증을 읽지 못했어요. 기존 재료는 바뀌지 않았어요. 다시 분석하거나 품목을 직접 입력해 주세요.',
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export async function commitReceipt(
  id: string,
  requestId: string,
  items: ConfirmedItem[],
): Promise<Ingredient[]> {
  const { client, row } = await rawDraft(id);
  parseId(requestId);
  if (!Array.isArray(items) || items.length < 1 || items.length > 100)
    throw new AppError('validation', '저장할 품목을 1~100개 확인해 주세요.');
  const confirmed = items.map((item) => {
    const parsed = parseCreateIngredient({ requestId, ...item });
    return { name: parsed.name, storage: parsed.storage, expiresOn: parsed.expiresOn };
  });
  const result = await client.rpc('commit_receipt', {
    draft_id: row.id,
    commit_request: requestId,
    confirmed_items: confirmed,
  });
  checkDatabaseError(result.error);
  if (!Array.isArray(result.data)) throw new AppError('internal', '저장 결과를 확인하지 못했어요.');
  const saved = (result.data as unknown as Tables<'ingredients'>[]).map(toIngredient);
  await cleanOne(row.id);
  return saved;
}
export async function cancelReceipt(id: string): Promise<void> {
  await requireUser();
  const client = await createServerSupabaseClient();
  const result = await client.rpc('cancel_receipt', { draft_id: parseId(id) });
  checkDatabaseError(result.error);
  await cleanOne(id);
}
export async function cleanupReceipts(): Promise<{ cleaned: number; pending: number }> {
  const admin = createAdminSupabaseClient();
  const expired = await admin.rpc('expire_receipts');
  checkDatabaseError(expired.error);
  const rows = await admin
    .from('receipt_drafts')
    .select('id')
    .eq('cleanup_pending', true)
    .limit(100);
  checkDatabaseError(rows.error);
  let cleaned = 0;
  for (const row of rows.data ?? []) if (await cleanOne(row.id)) cleaned++;
  return { cleaned, pending: (rows.data?.length ?? 0) - cleaned };
}
