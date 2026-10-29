// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RenameFridgeDialog } from './rename-fridge-dialog';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('rename_submits_only_name_and_refreshes_after_success', async () => {
  const saved = vi.fn(),
    fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ data: { id: 'fridge', name: '우리 집' } }),
    );
  vi.stubGlobal('fetch', fetcher);
  render(
    <RenameFridgeDialog
      fridgeId="fridge"
      name="내 냉장고"
      onClose={() => {}}
      onSaved={saved}
      onAccessLost={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText('냉장고 이름'), { target: { value: '  우리 집  ' } });
  fireEvent.click(screen.getByRole('button', { name: '이름 저장' }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(fetcher.mock.calls[0][0]).toBe('/api/fridges/fridge');
  expect(JSON.parse(String(fetcher.mock.calls[0][1]!.body))).toEqual({ name: '우리 집' });
});
