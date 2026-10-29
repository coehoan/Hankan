import 'server-only';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { parseIngredientPatch, parseVersion } from './domain';

export async function readInventoryJson(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 8192)
    throw new AppError('validation', '입력 내용이 너무 길어요.');
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError('validation', '입력 내용을 확인해 주세요.');
  }
}

const updateSchema = z.object({ expectedVersion: z.unknown(), patch: z.unknown() }).strict();
const deleteSchema = z.object({ expectedVersion: z.unknown() }).strict();

export function parseUpdateBody(body: unknown) {
  const result = updateSchema.safeParse(body);
  if (!result.success) throw new AppError('validation', '수정 요청을 확인해 주세요.');
  return {
    expectedVersion: parseVersion(result.data.expectedVersion),
    patch: parseIngredientPatch(result.data.patch),
  };
}

export function parseDeleteBody(body: unknown) {
  const result = deleteSchema.safeParse(body);
  if (!result.success) throw new AppError('validation', '삭제 요청을 확인해 주세요.');
  return { expectedVersion: parseVersion(result.data.expectedVersion) };
}

export function inventoryResponse(data: unknown, status = 200) {
  return Response.json({ data }, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
