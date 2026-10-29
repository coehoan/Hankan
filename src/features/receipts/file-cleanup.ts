import 'server-only';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
export async function removeReceiptFiles(files: {
  objectPath: string;
  stagedObjectPath?: string | null;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  const tasks = [admin.storage.from('receipt-originals').remove([files.objectPath])];
  if (files.stagedObjectPath)
    tasks.push(admin.storage.from('receipt-uploads').remove([files.stagedObjectPath]));
  const results = await Promise.allSettled(tasks);
  if (results.some((result) => result.status === 'rejected' || result.value.error))
    throw new Error('Cannot remove receipt files');
}
