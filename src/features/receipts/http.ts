import { z } from 'zod';
import { siteOrigin } from '@/lib/env';
import { AppError } from '@/lib/errors';
export const emptyBody = z.object({}).strict();
export async function boundedBody(request: Request, max: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new AppError('validation', '입력 내용을 확인해 주세요.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new AppError(
          'validation',
          '파일 또는 입력 내용이 너무 커요. 사진은 10MB 이하로 올려 주세요.',
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export function assertReceiptOrigin(request: Request, json = true) {
  if (request.headers.get('origin') !== siteOrigin())
    throw new AppError('forbidden', '허용되지 않은 요청이에요.');
  const type = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (
    json
      ? type.split(';')[0].trim() !== 'application/json'
      : !type.startsWith('multipart/form-data;')
  )
    throw new AppError('validation', '올바른 형식으로 다시 요청해 주세요.');
}
export async function receiptJson(request: Request) {
  try {
    return JSON.parse((await boundedBody(request, 65536)).toString('utf8')) as unknown;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('validation', '입력 내용을 확인해 주세요.');
  }
}
export function checked<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError('validation', '입력 내용을 확인해 주세요.');
  return parsed.data;
}
export const receiptResponse = (data: unknown, status = 200) =>
  Response.json(
    { data },
    {
      status,
      headers: {
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    },
  );
