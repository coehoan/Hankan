import { z } from 'zod';
import { after } from 'next/server';
import { assertSameOrigin, requireFridgeAccess } from '@/lib/auth';
import { AppError, errorResponse } from '@/lib/errors';
import { parseId } from '@/features/inventory/domain';
import { readInventoryJson } from '@/features/inventory/http';
import { enqueueRecipeJob } from '@/features/recipes/jobs';
import { processRecipeJobs } from '@/features/recipes/job-worker';
export const maxDuration = 180;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ fridgeId: string }> },
) {
  try {
    assertSameOrigin(request);
    const input = z
      .object({ requestId: z.string().uuid() })
      .strict()
      .safeParse(await readInventoryJson(request));
    if (!input.success) throw new AppError('validation', '추천 요청을 확인해 주세요.');
    const access = await requireFridgeAccess(parseId((await params).fridgeId));
    const result = await enqueueRecipeJob(access, input.data.requestId);
    if (result.status === 'queued' || result.status === 'running')
      after(async () => {
        try {
          await processRecipeJobs(result.id);
        } catch {
          console.error('Recipe job deferred; worker will retry');
        }
      });
    return Response.json(
      { data: result },
      { status: 202, headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
