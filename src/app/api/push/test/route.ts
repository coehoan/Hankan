import { assertSameOrigin } from '@/lib/auth';
import { errorResponse } from '@/lib/errors';
import { inventoryResponse } from '@/features/inventory/http';
import { sendTestPush } from '@/features/notifications/subscriptions';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await sendTestPush();
    return inventoryResponse({ sent: true });
  } catch (error) {
    return errorResponse(error);
  }
}
