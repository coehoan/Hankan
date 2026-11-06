import { listRecipeJobs, listRecipeActivity } from '@/features/recipes/jobs';
import { errorResponse } from '@/lib/errors';
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    return Response.json(
      {
        data:
          query.get('activity') === '1'
            ? await listRecipeActivity()
            : await listRecipeJobs(query.get('fridgeId') ?? undefined, query.get('latest') === '1'),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
