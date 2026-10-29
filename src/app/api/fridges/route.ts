import { z } from 'zod';
import { assertSameOrigin } from '@/lib/auth';
import { AppError, errorResponse } from '@/lib/errors';
import { inventoryResponse, readInventoryJson } from '@/features/inventory/http';
import { parseId } from '@/features/inventory/domain';
import { loadFridgeDirectory, selectFridge } from '@/features/shell/service';
export async function GET() {
  try {
    return inventoryResponse((await loadFridgeDirectory()).fridges);
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = z
      .object({ fridgeId: z.string() })
      .strict()
      .safeParse(await readInventoryJson(request));
    if (!parsed.success) throw new AppError('validation', '냉장고 선택을 확인해 주세요.');
    const id = parseId(parsed.data.fridgeId);
    await selectFridge(id);
    return inventoryResponse({ selectedId: id });
  } catch (error) {
    return errorResponse(error);
  }
}
