// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';
vi.mock('@/features/inventory/inventory-realtime', () => ({
  subscribeToInventory: () => () => {},
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('keeps_keyboard_fridge_switching_beside_the_inventory_heading', async () => {
  const fetcher = vi.fn(async () => Response.json({ data: [] }));
  vi.stubGlobal('fetch', fetcher);
  render(
    <AppShell
      fridges={[
        { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: '우리집', role: 'owner' },
        { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: '함께 쓰는 냉장고', role: 'member' },
      ]}
      selectedId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      initialToday="2026-10-28"
      timeZone="Asia/Seoul"
    />,
  );
  const picker = screen.getByRole('combobox', { name: '냉장고 선택' });
  expect(screen.getByRole('main')).toContainElement(picker);
  fireEvent.keyDown(picker, { key: 'ArrowDown' });
  fireEvent.keyDown(picker, { key: 'End' });
  fireEvent.keyDown(picker, { key: 'Enter' });
  await waitFor(() =>
    expect(fetcher).toHaveBeenCalledWith(
      '/api/fridges',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ fridgeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
      }),
    ),
  );
});
it('management_dialogs_close_without_leaving_duplicates', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ data: [] }))),
  );
  render(
    <AppShell
      view="management"
      fridges={[{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: '우리집', role: 'owner' }]}
      selectedId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      initialToday="2026-10-28"
      timeZone="Asia/Seoul"
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '멤버 관리' }));
  await screen.findByRole('dialog', { name: '함께 쓰는 사람들' });
  fireEvent.click(screen.getByRole('button', { name: '함께 쓰는 사람들 닫기' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '냉장고 이름 변경' }));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
});
it('notification_settings_link_opens_mypage_instead_of_a_modal', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown) =>
      Response.json({
        data: String(url).endsWith('/notifications')
          ? { enabled: false, localTime: '09:00', timezone: 'Asia/Seoul', nextRunAt: null }
          : [],
      }),
    ),
  );
  render(
    <AppShell
      fridges={[{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: '우리집', role: 'owner' }]}
      selectedId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      initialToday="2026-10-28"
      timeZone="Asia/Seoul"
    />,
  );
  expect(screen.queryByRole('link', { name: '알림 설정' })).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '멤버 관리' })).not.toBeInTheDocument();
});
