import { assertSameOrigin } from '@/lib/auth';
import { errorResponse } from '@/lib/errors';
import { readInventoryJson, inventoryResponse } from '@/features/inventory/http';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
} from '@/features/notifications/settings';
export async function GET() {
  try {
    return inventoryResponse(await getNotificationPreferences());
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    return inventoryResponse(
      await saveNotificationPreferences(
        (await readInventoryJson(request)) as { enabled: boolean; localTime: string },
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
