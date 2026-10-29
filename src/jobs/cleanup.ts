export interface CleanupStore {
  expire(now: string): Promise<void>;
  pending(): Promise<{ id: string; path: string; stagedPath?: string | null }[]>;
  remove(path: string, stagedPath?: string | null): Promise<void>;
  complete(id: string): Promise<void>;
}
export async function cleanReceipts(
  now: string,
  store: CleanupStore,
): Promise<{ deleted: number; failed: number }> {
  await store.expire(now);
  let deleted = 0,
    failed = 0;
  for (const item of await store.pending())
    try {
      await store.remove(item.path, item.stagedPath);
      await store.complete(item.id);
      deleted++;
    } catch {
      failed++;
    }
  return { deleted, failed };
}
