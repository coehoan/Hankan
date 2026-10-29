// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UploadForm } from './upload-form';
const created = vi.fn(),
  requests: { url: string; method: string }[] = [];
beforeEach(() => {
  const NativeURL = URL;
  vi.stubGlobal(
    'URL',
    class extends NativeURL {
      static createObjectURL() {
        return 'blob:receipt-preview';
      }
      static revokeObjectURL() {}
    },
  );
  requests.length = 0;
  created.mockReset();
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    requests.push({ url, method });
    if (url.startsWith('/api/receipts?')) return Response.json({ data: [] });
    if (url === '/api/receipts/uploads')
      return Response.json({
        data: { objectPath: 'owned-path', uploadUrl: 'https://storage.test/upload' },
      });
    if (url === 'https://storage.test/upload') return Response.json({ Key: 'owned-path' });
    if (url === '/api/receipts/uploads/complete')
      return Response.json({ data: { draftId: 'new-draft' } });
    if (url === '/api/receipts/new-draft/analyze') return Response.json({ data: [] });
    throw new Error('Unexpected request');
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const show = () =>
  render(
    <UploadForm
      fridgeId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      fridgeName="우리집"
      onClose={() => {}}
      onCreated={created}
    />,
  );
it('photo_selection_previews_without_upload_then_confirmation_uploads_and_analyzes', async () => {
  show();
  expect(screen.getByRole('button', { name: '사진 업로드' })).toBeVisible();
  fireEvent.change(screen.getByLabelText('영수증 사진 선택'), {
    target: { files: [new File(['png'], 'receipt.png', { type: 'image/png' })] },
  });
  expect(await screen.findByRole('img', { name: '선택한 영수증 미리보기' })).toHaveAttribute(
    'src',
    'blob:receipt-preview',
  );
  expect(requests.filter((r) => r.method !== 'GET')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: '품목 확인' }));
  await waitFor(() => expect(created).toHaveBeenCalledWith('new-draft'));
  expect(requests.filter((r) => r.method !== 'GET').map((r) => r.url)).toEqual([
    '/api/receipts/uploads',
    'https://storage.test/upload',
    '/api/receipts/uploads/complete',
    '/api/receipts/new-draft/analyze',
  ]);
});
it('waits_for_analysis_before_opening_results_and_prevents_duplicate_confirmation', async () => {
  const originalFetch = fetch;
  let finish!: (response: Response) => void;
  const analysis = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const analyze = vi.fn(() => analysis);
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
    url.endsWith('/analyze') ? analyze() : originalFetch(url, init),
  );
  show();
  fireEvent.change(screen.getByLabelText('영수증 사진 선택'), {
    target: { files: [new File(['png'], 'receipt.png', { type: 'image/png' })] },
  });
  fireEvent.click(screen.getByRole('button', { name: '품목 확인' }));
  await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'AI 분석 중…' })).toBeDisabled();
  expect(created).not.toHaveBeenCalled();
  fireEvent.submit(screen.getByRole('form', { name: '우리집 영수증 등록' }));
  expect(analyze).toHaveBeenCalledTimes(1);
  finish(Response.json({ data: [] }));
  await waitFor(() => expect(created).toHaveBeenCalledExactlyOnceWith('new-draft'));
});
it.each(['server', 'network'])(
  'analysis_%s_failure_opens_existing_draft_for_retry',
  async (failure) => {
    const originalFetch = fetch;
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      if (!url.endsWith('/analyze')) return originalFetch(url, init);
      if (failure === 'network') return Promise.reject(new Error('Connection lost'));
      return Promise.resolve(Response.json({ error: { message: '분석 실패' } }, { status: 502 }));
    });
    show();
    fireEvent.change(screen.getByLabelText('영수증 사진 선택'), {
      target: { files: [new File(['png'], 'receipt.png', { type: 'image/png' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: '품목 확인' }));
    await waitFor(() => expect(created).toHaveBeenCalledExactlyOnceWith('new-draft'));
    expect(requests.filter((r) => r.url === '/api/receipts/uploads/complete')).toHaveLength(1);
  },
);
it('invalid_photo_never_enables_confirmation_or_uploads', async () => {
  show();
  fireEvent.change(screen.getByLabelText('영수증 사진 선택'), {
    target: { files: [new File(['pdf'], 'receipt.pdf', { type: 'application/pdf' })] },
  });
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByRole('button', { name: '품목 확인' })).toBeDisabled();
  expect(requests.filter((r) => r.method !== 'GET')).toHaveLength(0);
});
it('selecting_the_same_photo_again_keeps_its_preview', async () => {
  show();
  const file = new File(['png'], 'receipt.png', { type: 'image/png' }),
    input = screen.getByLabelText('영수증 사진 선택');
  fireEvent.change(input, { target: { files: [file] } });
  expect(await screen.findByRole('img', { name: '선택한 영수증 미리보기' })).toBeVisible();
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() =>
    expect(screen.getByRole('img', { name: '선택한 영수증 미리보기' })).toBeVisible(),
  );
});
