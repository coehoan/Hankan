import { assertSameOrigin } from '@/lib/auth';
import { AppError, errorResponse } from '@/lib/errors';
import { inventoryResponse } from '@/features/inventory/http';
import { sendTestPush } from '@/features/notifications/subscriptions';

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV !== 'development')
      throw new AppError('not_found', '페이지를 찾을 수 없어요.');
    assertSameOrigin(request);
    await sendTestPush();
    return inventoryResponse({ sent: true });
  } catch (error) {
    return errorResponse(error);
  }
}
