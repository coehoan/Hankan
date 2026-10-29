import { assertSameOrigin, requireFridgeAccess } from '@/lib/auth';
import { errorResponse } from '@/lib/errors';
import { parseId } from '@/features/inventory/domain';
import { deleteIngredient, updateIngredient } from '@/features/inventory/service';
import {
  inventoryResponse,
  parseDeleteBody,
  parseUpdateBody,
  readInventoryJson,
} from '@/features/inventory/http';

type Context = { params: Promise<{ fridgeId: string; ingredientId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { fridgeId, ingredientId } = await context.params;
    const access = await requireFridgeAccess(parseId(fridgeId));
    const { expectedVersion, patch } = parseUpdateBody(await readInventoryJson(request));
    return inventoryResponse(
      await updateIngredient(access, parseId(ingredientId), expectedVersion, patch),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { fridgeId, ingredientId } = await context.params;
    const access = await requireFridgeAccess(parseId(fridgeId));
    const { expectedVersion } = parseDeleteBody(await readInventoryJson(request));
    await deleteIngredient(access, parseId(ingredientId), expectedVersion);
    return inventoryResponse(null);
  } catch (error) {
    return errorResponse(error);
  }
}
