import { it, expect, vi } from 'vitest';
import { cleanReceipts, type CleanupStore } from '@/jobs/cleanup';
it('expired_receipt_cleanup_retries', async () => {
  const store: CleanupStore = {
    expire: vi.fn(),
    pending: vi.fn().mockResolvedValue([{ id: 'receipt', path: 'private/photo' }]),
    remove: vi.fn().mockRejectedValueOnce(new Error('temporary')).mockResolvedValue(undefined),
    complete: vi.fn(),
  };
  expect(await cleanReceipts('2026-10-28T00:00:00Z', store)).toEqual({ deleted: 0, failed: 1 });
  expect(store.complete).not.toHaveBeenCalled();
  expect(await cleanReceipts('2026-10-28T00:01:00Z', store)).toEqual({ deleted: 1, failed: 0 });
  expect(store.complete).toHaveBeenCalledWith('receipt');
});
