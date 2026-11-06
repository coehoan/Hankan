import { notFound } from 'next/navigation';
import { getRecipeJob } from '@/features/recipes/jobs';
import { loadFridgeDirectory } from '@/features/shell/service';
import { AppShell } from '@/features/shell/app-shell';
import { localDateAt } from '@/features/notifications/schedule';
import { AppError } from '@/lib/errors';
export const metadata = { title: '저장된 요리 추천' };
export default async function SavedRecipePage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  let job;
  try {
    job = await getRecipeJob(jobId);
  } catch (error) {
    if (error instanceof AppError && ['not_found', 'validation'].includes(error.code)) notFound();
    throw error;
  }
  const directory = await loadFridgeDirectory();
  return (
    <AppShell
      accountName={directory.accountName}
      view="recipes"
      savedJobId={jobId}
      fridges={directory.fridges}
      selectedId={job.fridgeId}
      initialToday={localDateAt(new Date().toISOString(), directory.timeZone)}
      timeZone={directory.timeZone}
    />
  );
}
