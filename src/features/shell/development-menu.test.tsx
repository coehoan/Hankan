// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DevelopmentMenu } from './development-menu';
import { ProfileMenu } from './profile-menu';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('does not expose the menu in production', () => {
  vi.stubEnv('NODE_ENV', 'production');
  render(<ProfileMenu accountName="테스트" fridgeId="fridge" />);
  fireEvent.click(screen.getByRole('button', { name: '테스트 계정 메뉴' }));
  expect(screen.queryByRole('menuitem', { name: '개발 메뉴' })).not.toBeInTheDocument();
});
it('opens development tools from the profile menu', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  render(<ProfileMenu accountName="테스트" fridgeId="fridge" />);
  fireEvent.click(screen.getByRole('button', { name: '테스트 계정 메뉴' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '개발 메뉴' }));
  expect(screen.getByRole('dialog', { name: '개발 메뉴' })).toBeVisible();
  expect(screen.getByRole('button', { name: '테스트 푸시 보내기' })).toBeVisible();
});
it.each(['running', 'complete', 'failed'])(
  'previews %s without creating a real job',
  async (status) => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.useFakeTimers();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const change = vi.fn();
    const props = { open: true, onOpenChange: change, fallbackFocus: () => null };
    const view = render(<DevelopmentMenu {...props} />);
    fireEvent.click(
      screen.getByRole('button', {
        name:
          status === 'running'
            ? '진행 팝업 보기'
            : status === 'complete'
              ? '준비 팝업 보기'
              : '실패 팝업 보기',
      }),
    );
    expect(change).toHaveBeenCalledWith(false);
    view.rerender(<DevelopmentMenu {...props} open={false} />);
    expect(screen.getByRole('complementary')).toHaveAttribute('data-status', status);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    if (status === 'running') expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    else {
      expect(screen.getByRole('complementary')).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: '요리 추천 알림 닫기' }));
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    }
    expect(fetcher).not.toHaveBeenCalled();
  },
);
it('sends a test push to the existing current-device API and displays errors', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ data: { sent: true } }))
    .mockResolvedValueOnce(
      Response.json({ error: { message: '기기를 연결해 주세요.' } }, { status: 404 }),
    );
  vi.stubGlobal('fetch', fetcher);
  render(<DevelopmentMenu open onOpenChange={() => {}} fallbackFocus={() => null} />);
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '테스트 푸시 보내기' })),
  );
  expect(fetcher).toHaveBeenCalledWith(
    '/api/push/test',
    expect.objectContaining({ method: 'POST', body: '{}' }),
  );
  expect(screen.getByRole('status')).toHaveTextContent('테스트 알림을 보냈어요');
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '테스트 푸시 보내기' })),
  );
  expect(screen.getByRole('alert')).toHaveTextContent('기기를 연결해 주세요.');
});
