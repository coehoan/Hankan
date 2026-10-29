import { requireFridgeAccess, requireUser } from '@/lib/auth';
import { AppError, errorResponse } from '@/lib/errors';
import { parseId } from '@/features/inventory/domain';
import { createReceiptDraft, listReceiptDrafts } from '@/features/receipts/service';
import { MAX_IMAGE_BYTES, verifyReceiptImage } from '@/features/receipts/image';
import { assertReceiptOrigin, boundedBody, receiptResponse } from '@/features/receipts/http';
export async function GET(request: Request) {
  try {
    return receiptResponse(
      await listReceiptDrafts(parseId(new URL(request.url).searchParams.get('fridgeId') ?? '')),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    assertReceiptOrigin(request, false);
    await requireUser();
    const bytes = await boundedBody(request, MAX_IMAGE_BYTES + 65536);
    const data = await new Response(bytes, {
      headers: { 'Content-Type': request.headers.get('content-type')! },
    }).formData();
    if ([...data.keys()].length !== 2)
      throw new AppError('validation', '사진 한 장과 저장할 냉장고를 확인해 주세요.');
    const access = await requireFridgeAccess(parseId(String(data.get('fridgeId') ?? ''))),
      file = data.get('file');
    if (!(file instanceof File)) throw new AppError('validation', '영수증 사진을 선택해 주세요.');
    return receiptResponse(
      await createReceiptDraft(
        access,
        await verifyReceiptImage(new Uint8Array(await file.arrayBuffer()), file.type),
      ),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
