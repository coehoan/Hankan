import { afterEach, expect, it, vi } from 'vitest';
import { uploadReceipt } from './upload-client';
afterEach(() => vi.unstubAllGlobals());
it('large_image_bypasses_web_api_and_completes_only_after_storage_success', async () => {
  const seen: { url: string; body: unknown }[] = [];
  const file = new File([new Uint8Array(5_000_000)], 'receipt.png', { type: 'image/png' });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    seen.push({ url, body: init.body });
    if (url === '/api/receipts/uploads')
      return Response.json({
        data: { uploadUrl: 'https://storage.example.test/signed', objectPath: 'owned-path' },
      });
    if (url === 'https://storage.example.test/signed') return Response.json({ Key: 'owned-path' });
    if (url === '/api/receipts/uploads/complete')
      return Response.json({ data: { draftId: 'draft-id' } });
    throw new Error('Unexpected request');
  });
  expect(await uploadReceipt('fridge-id', file)).toBe('draft-id');
  expect(seen.map((r) => r.url)).toEqual([
    '/api/receipts/uploads',
    'https://storage.example.test/signed',
    '/api/receipts/uploads/complete',
  ]);
  expect(seen[1].body).toBe(file);
  expect(String(seen[0].body).length).toBeLessThan(300);
  expect(String(seen[2].body).length).toBeLessThan(300);
});
it('failed_storage_upload_does_not_create_a_canonical_draft', async () => {
  const seen: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    seen.push(url);
    return url === '/api/receipts/uploads'
      ? Response.json({
          data: { uploadUrl: 'https://storage.example.test/signed', objectPath: 'owned-path' },
        })
      : new Response(null, { status: 500 });
  });
  await expect(
    uploadReceipt('fridge-id', new File(['bytes'], 'receipt.png', { type: 'image/png' })),
  ).rejects.toThrow();
  expect(seen).toEqual(['/api/receipts/uploads', 'https://storage.example.test/signed']);
});
