import 'server-only';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
export function expiredStagedPaths(
  objects: { name: string; created_at?: string | null }[],
  now: string,
): string[] {
  const cutoff = Date.parse(now) - 125 * 60_000;
  return objects
    .filter((object) => object.created_at && Date.parse(object.created_at) < cutoff)
    .map((object) => object.name);
}
export async function cleanupStagedUploads(now: string) {
  const admin = createAdminSupabaseClient(),
    storage = admin.storage.from('receipt-uploads');
  const { data, error } = await storage.list('', {
    limit: 100,
    sortBy: { column: 'created_at', order: 'asc' },
  });
  if (error) throw new Error('Cannot list staged uploads');
  let deleted = 0,
    failed = 0;
  const expired = expiredStagedPaths(data ?? [], now);
  if (expired.length) {
    const removed = await storage.remove(expired);
    if (removed.error) failed += expired.length;
    else deleted += expired.length;
  }
  const cutoff = Date.parse(now) - 125 * 60_000;
  let cursor: string | null = null;
  while (true) {
    let query = admin
      .from('receipt_drafts')
      .select('id,staged_object_path,created_at')
      .in('status', ['saved', 'cancelled'])
      .not('staged_object_path', 'is', null)
      .order('id', { ascending: true })
      .limit(100);
    if (cursor) query = query.gt('id', cursor);
    const closed = await query;
    if (closed.error) throw new Error('Cannot list closed staged uploads');
    const rows = closed.data ?? [];
    if (!rows.length) break;
    const paths = rows.flatMap((row) => (row.staged_object_path ? [row.staged_object_path] : []));
    const removed = await storage.remove(paths);
    if (removed.error) failed += paths.length;
    else {
      deleted += paths.length;
      const retired = rows
        .filter((row) => Date.parse(row.created_at) < cutoff)
        .map((row) => row.id);
      if (retired.length) {
        const updated = await admin
          .from('receipt_drafts')
          .update({ staged_object_path: null })
          .in('id', retired)
          .in('status', ['saved', 'cancelled']);
        if (updated.error) throw new Error('Cannot retire staged upload links');
      }
    }
    cursor = rows[rows.length - 1].id;
    if (rows.length < 100) break;
  }
  return { deleted, failed };
}
