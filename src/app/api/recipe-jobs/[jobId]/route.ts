import { getRecipeJob, hideRecipeJob } from '@/features/recipes/jobs';
import { assertSameOrigin } from '@/lib/auth';
import { errorResponse } from '@/lib/errors';
type Context = { params: Promise<{ jobId: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    return Response.json(
      { data: await getRecipeJob((await params).jobId) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    await hideRecipeJob((await params).jobId);
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
