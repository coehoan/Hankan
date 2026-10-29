// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';
vi.mock('@/features/inventory/inventory-realtime', () => ({
  subscribeToInventory: () => () => {},
}));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  shared = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const props = {
  accountName: 'fresh_user',
  fridges: [
    { id, name: '우리집', role: 'owner' as const },
    { id: shared, name: '함께 냉장고', role: 'member' as const },
  ],
  selectedId: id,
  initialToday: '2026-10-29',
  timeZone: 'Asia/Seoul',
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ data: [] })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('profile_initial_opens_three_actions_and_supports_keyboard_and_outside_close', () => {
  render(<AppShell {...props} />);
  const avatar = screen.getByRole('button', { name: 'fresh_user 계정 메뉴' });
  expect(avatar).toHaveTextContent('F');
  fireEvent.click(avatar);
  const menu = screen.getByRole('menu', { name: '계정 메뉴' });
  expect(within(menu).getAllByRole('menuitem')).toHaveLength(3);
  const mypage = within(menu).getByRole('menuitem', { name: '마이페이지' });
  expect(mypage).toHaveAttribute('href', '/mypage');
  expect(mypage).toHaveFocus();
  expect(within(menu).getByRole('menuitem', { name: '냉장고 관리' })).toHaveAttribute(
    'href',
    '/fridges/manage?fridgeId=' + id,
  );
  expect(within(menu).getByRole('menuitem', { name: '로그아웃' })).toBeVisible();
  fireEvent.keyDown(menu, { key: 'ArrowDown' });
  expect(within(menu).getByRole('menuitem', { name: '냉장고 관리' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(avatar).toHaveFocus();
  fireEvent.click(avatar);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
it('inventory_registration_chooses_manual_or_receipt_without_old_toolbar_actions', async () => {
  const { container } = render(<AppShell {...props} />);
  expect(container.querySelector('.fridge-role')).toBeNull();
  fireEvent.click(screen.getByRole('combobox', { name: '냉장고 선택' }));
  expect(screen.getByRole('option', { name: '우리집 · 내 소유' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '함께 냉장고 · 함께 관리' })).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('combobox', { name: '냉장고 선택' }), { key: 'Escape' });
  expect(screen.queryByRole('button', { name: '영수증 등록' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '멤버 관리' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '냉장고 이름 변경' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '재료 등록' }));
  expect(screen.getByRole('dialog', { name: '재료 등록 방법' })).toBeVisible();
  expect(screen.queryByRole('form', { name: '재료 등록' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '직접 입력' }));
  expect(screen.getByRole('form', { name: '재료 등록' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '재료 등록 닫기' }));
  fireEvent.click(screen.getByRole('button', { name: '재료 등록' }));
  fireEvent.click(screen.getByRole('button', { name: '영수증 등록' }));
  expect(await screen.findByRole('dialog', { name: '영수증으로 등록' })).toBeVisible();
  expect(screen.getByRole('button', { name: '사진 업로드' })).toBeVisible();
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
});
it('management_owns_name_and_members_and_stays_on_management_after_switch', async () => {
  render(<AppShell {...props} view="management" />);
  expect(screen.getByRole('heading', { name: '냉장고 관리' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '냉장고 이름 변경' }));
  expect(screen.getByRole('dialog', { name: '냉장고 이름 변경' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '냉장고 이름 변경 닫기' }));
  fireEvent.click(screen.getByRole('button', { name: '멤버 관리' }));
  expect(await screen.findByRole('dialog', { name: '함께 쓰는 사람들' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '함께 쓰는 사람들 닫기' }));
  fireEvent.click(screen.getByRole('combobox', { name: '냉장고 선택' }));
  fireEvent.click(screen.getByRole('option', { name: '함께 냉장고 · 함께 관리' }));
  await waitFor(() =>
    expect(router.push).toHaveBeenCalledWith('/fridges/manage?fridgeId=' + shared),
  );
  expect(vi.mocked(fetch)).toHaveBeenCalledWith(
    '/api/fridges',
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ fridgeId: shared }) }),
  );
});
