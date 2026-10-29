import { z } from 'zod';
import { errorResponse } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { completeReceiptUpload } from '@/features/receipts/direct-upload';
import {
  assertReceiptOrigin,
  checked,
  receiptJson,
  receiptResponse,
} from '@/features/receipts/http';
const input = z.object({ fridgeId: z.string().uuid(), objectPath: z.string().max(120) }).strict();
export async function POST(request: Request) {
  try {
    assertReceiptOrigin(request);
    await requireUser();
    const body = checked(input, await receiptJson(request));
    return receiptResponse(await completeReceiptUpload(body.fridgeId, body.objectPath), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
