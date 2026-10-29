import { errorResponse } from '@/lib/errors';
import { acceptInvite, inspectInvite } from '@/features/sharing/service';
import { emptySharingBody, sharingResponse } from '@/features/sharing/http';
type Context = { params: Promise<{ token: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    return sharingResponse(await inspectInvite((await context.params).token));
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    await emptySharingBody(request);
    return sharingResponse(await acceptInvite((await context.params).token));
  } catch (error) {
    return errorResponse(error);
  }
}
