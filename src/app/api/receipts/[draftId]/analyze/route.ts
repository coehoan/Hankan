import { errorResponse } from '@/lib/errors';
import { analyzeReceipt } from '@/features/receipts/service';
import {
  assertReceiptOrigin,
  checked,
  emptyBody,
  receiptJson,
  receiptResponse,
} from '@/features/receipts/http';
export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  try {
    assertReceiptOrigin(request);
    checked(emptyBody, await receiptJson(request));
    return receiptResponse(await analyzeReceipt((await params).draftId));
  } catch (error) {
    return errorResponse(error);
  }
}
