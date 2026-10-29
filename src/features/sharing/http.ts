import { z } from 'zod';
import { assertSameOrigin } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { readInventoryJson } from '@/features/inventory/http';
export async function sharingBody(request: Request) {
  assertSameOrigin(request);
  return readInventoryJson(request);
}
export async function emptySharingBody(request: Request) {
  if (
    !z
      .object({})
      .strict()
      .safeParse(await sharingBody(request)).success
  )
    throw new AppError('validation', '요청 내용을 확인해 주세요.');
}
export function sharingResponse(data: unknown, status = 200) {
  return Response.json(
    { data },
    {
      status,
      headers: {
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    },
  );
}
