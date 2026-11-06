import { getRecipeJob } from '@/features/recipes/jobs';
import { errorResponse } from '@/lib/errors';
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    return Response.json(
      { data: await getRecipeJob((await params).jobId) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
