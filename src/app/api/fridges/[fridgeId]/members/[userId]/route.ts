import { requireFridgeAccess } from '@/lib/auth';
import { errorResponse } from '@/lib/errors';
import { parseId } from '@/features/inventory/domain';
import { leaveFridge, removeMember } from '@/features/sharing/service';
import { emptySharingBody, sharingResponse } from '@/features/sharing/http';
export async function DELETE(
  request: Request,
  context: { params: Promise<{ fridgeId: string; userId: string }> },
) {
  try {
    await emptySharingBody(request);
    const { fridgeId, userId } = await context.params;
    const access = await requireFridgeAccess(
      parseId(fridgeId),
      userId === 'me' ? 'member' : 'owner',
    );
    if (userId === 'me') await leaveFridge(access);
    else await removeMember(access, parseId(userId));
    return sharingResponse(null);
  } catch (error) {
    return errorResponse(error);
  }
}
