import { assertSameOrigin, requireFridgeAccess } from '@/lib/auth';
import { errorResponse } from '@/lib/errors';
import { parseCreateIngredient, parseId } from '@/features/inventory/domain';
import { createIngredient, listIngredients } from '@/features/inventory/service';
import { inventoryResponse, readInventoryJson } from '@/features/inventory/http';

type Context = { params: Promise<{ fridgeId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { fridgeId } = await context.params;
    const access = await requireFridgeAccess(parseId(fridgeId));
    return inventoryResponse(await listIngredients(access));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { fridgeId } = await context.params;
    const access = await requireFridgeAccess(parseId(fridgeId));
    const input = parseCreateIngredient(await readInventoryJson(request));
    return inventoryResponse(await createIngredient(access, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
