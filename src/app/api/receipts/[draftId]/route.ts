import { errorResponse } from '@/lib/errors';
import { cancelReceipt, getReceiptDraft, saveReceiptReview } from '@/features/receipts/service';
import { z } from 'zod';
import {
  assertReceiptOrigin,
  checked,
  emptyBody,
  receiptJson,
  receiptResponse,
} from '@/features/receipts/http';
type Context = { params: Promise<{ draftId: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    return receiptResponse(await getReceiptDraft((await params).draftId));
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    assertReceiptOrigin(request);
    checked(emptyBody, await receiptJson(request));
    await cancelReceipt((await params).draftId);
    return receiptResponse(null);
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    assertReceiptOrigin(request);
    const input = checked(
      z.object({ items: z.array(z.unknown()).max(100) }).strict(),
      await receiptJson(request),
    );
    await saveReceiptReview((await params).draftId, input.items);
    return receiptResponse(null);
  } catch (error) {
    return errorResponse(error);
  }
}
