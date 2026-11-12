// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RecipeJobStatus } from './recipe-job-status';
const preferences = (enabled: boolean) => ({
  enabled,
  localTime: '09:00',
  timezone: 'Asia/Seoul',
  nextRunAt: null,
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it.each([true, false])(
  'shows the settings link only for disabled notifications (enabled=%s)',
  async (enabled) => {
    const fetcher = vi.fn(async () => Response.json({ data: preferences(enabled) }));
    vi.stubGlobal('fetch', fetcher);
    render(<RecipeJobStatus hasResults={false} />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    await act(async () => {});
    expect(screen.getByText('요리를 추천하고 있어요')).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    const link = screen.queryByRole('link', { name: '알림 설정하기' });
    if (enabled) expect(link).not.toBeInTheDocument();
    else expect(link).toHaveAttribute('href', '/mypage#notifications');
  },
);
it.each([
  Response.json({ data: { enabled: false } }),
  Response.json({ error: {} }, { status: 500 }),
])('does not treat an unknown preference as disabled', async (response) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response),
  );
  await act(async () => {
    render(<RecipeJobStatus hasResults={false} />);
  });
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('refreshes preferences on return and ignores an older pending response', async () => {
  let resolveFirst!: (response: Response) => void;
  const fetcher = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        }),
    )
    .mockResolvedValueOnce(Response.json({ data: preferences(true) }))
    .mockResolvedValueOnce(Response.json({ data: preferences(false) }));
  vi.stubGlobal('fetch', fetcher);
  render(<RecipeJobStatus hasResults />);
  await act(async () => window.dispatchEvent(new Event('focus')));
  await act(async () => resolveFirst(Response.json({ data: preferences(false) })));
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(screen.getByRole('link', { name: '알림 설정하기' })).toBeVisible();
  expect(screen.getByText('먼저 준비된 요리부터 확인해 보세요')).toBeVisible();
});
