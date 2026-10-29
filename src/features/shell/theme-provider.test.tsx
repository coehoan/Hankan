// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { ThemeProvider, ThemeSelector, useThemePreference } from './theme-provider';
import { Dialog } from '@/components/ui/dialog';
import { InventoryScreen } from '@/features/inventory/inventory-screen';

let dark = false,
  online = true;
const changes = new Set<() => void>();
beforeEach(() => {
  dark = false;
  online = true;
  changes.clear();
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return dark;
    },
    addEventListener: (_name: string, fn: () => void) => changes.add(fn),
    removeEventListener: (_name: string, fn: () => void) => changes.delete(fn),
  }));
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ data: [] }), {
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
});
function ReadTheme() {
  const theme = useThemePreference();
  return <output aria-label="적용 테마">{theme.resolvedTheme}</output>;
}
function Fixture() {
  return (
    <ThemeProvider initialPreference="system">
      <ThemeSelector />
      <ReadTheme />
      <InventoryScreen
        fridgeId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        fridgeName="우리집"
        initialToday="2026-10-28"
      />
    </ThemeProvider>
  );
}

// Catches a provider that remounts descendants when only its theme changes.
it('system_theme_change_keeps_unsaved_form', async () => {
  render(<Fixture />);
  fireEvent.click(screen.getByRole('button', { name: '재료 등록' }));
  fireEvent.click(screen.getByRole('button', { name: '직접 입력' }));
  const dialog = screen.getByRole('dialog', { name: '재료 등록' });
  fireEvent.change(within(dialog).getByLabelText('재료 이름'), {
    target: { value: '손질해 둔 시금치' },
  });
  fireEvent.change(within(dialog).getByLabelText('유통기한'), { target: { value: '2026-11-02' } });
  act(() => {
    dark = true;
    changes.forEach((fn) => fn());
  });
  expect(within(dialog).getByLabelText('재료 이름')).toHaveValue('손질해 둔 시금치');
  expect(within(dialog).getByLabelText('유통기한')).toHaveValue('2026-11-02');
  expect(screen.getByLabelText('적용 테마')).toHaveTextContent('dark');
});
// Catches OS listeners overriding an explicit choice.
it('system_change_only_affects_system_preference', () => {
  render(
    <ThemeProvider initialPreference="system">
      <ThemeSelector />
      <ReadTheme />
    </ThemeProvider>,
  );
  act(() => {
    dark = true;
    changes.forEach((fn) => fn());
  });
  expect(screen.getByLabelText('적용 테마')).toHaveTextContent('dark');
  fireEvent.click(screen.getByRole('radio', { name: '라이트' }));
  act(() => {
    dark = false;
    changes.forEach((fn) => fn());
    dark = true;
    changes.forEach((fn) => fn());
  });
  expect(screen.getByLabelText('적용 테마')).toHaveTextContent('light');
  fireEvent.click(screen.getByRole('radio', { name: '시스템' }));
  expect(screen.getByLabelText('적용 테마')).toHaveTextContent('dark');
});
it('theme_selector_has_three_choices_and_explains_system_mode', () => {
  render(
    <ThemeProvider initialPreference="system">
      <ThemeSelector />
    </ThemeProvider>,
  );
  const choices = screen.getByRole('radiogroup', { name: '화면 테마' });
  expect(within(choices).getAllByRole('radio')).toHaveLength(3);
  expect(screen.getByRole('radio', { name: '시스템' })).toBeChecked();
  expect(screen.getByText('시스템: 기기의 다크 모드 설정을 따릅니다.')).toBeVisible();
  fireEvent.click(screen.getByRole('radio', { name: '다크' }));
  expect(screen.getByRole('radio', { name: '다크' })).toBeChecked();
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
});
function DialogFixture() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>열기</button>
      <Dialog open={open} title="재료 입력" onOpenChange={setOpen}>
        <input aria-label="재료" />
        <button onClick={() => setOpen(false)}>완료</button>
      </Dialog>
    </>
  );
}
// Catches missing focus capture, trapping and restoration to the actual opener.
it('dialog_restores_focus', async () => {
  const user = userEvent.setup();
  render(<DialogFixture />);
  const opener = screen.getByRole('button', { name: '열기' });
  await user.click(opener);
  const dialog = screen.getByRole('dialog', { name: '재료 입력' });
  expect(dialog).toContainElement(document.activeElement as HTMLElement);
  const last = within(dialog).getByRole('button', { name: '완료' });
  last.focus();
  await user.tab();
  expect(dialog).toContainElement(document.activeElement as HTMLElement);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});
// Catches a modal remount/discard when connectivity changes.
it('offline_disables_mutations_without_losing_input', async () => {
  render(<Fixture />);
  fireEvent.click(screen.getByRole('button', { name: '재료 등록' }));
  fireEvent.click(screen.getByRole('button', { name: '직접 입력' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('재료 이름'), { target: { value: '표고버섯' } });
  act(() => {
    online = false;
    window.dispatchEvent(new Event('offline'));
  });
  expect(within(dialog).getByRole('button', { name: '저장' })).toBeDisabled();
  expect(within(dialog).getByLabelText('재료 이름')).toHaveValue('표고버섯');
  act(() => {
    online = true;
    window.dispatchEvent(new Event('online'));
  });
  await waitFor(() => expect(within(dialog).getByRole('button', { name: '저장' })).toBeEnabled());
});
it('clears_private_descendants_when_signing_out', () => {
  render(
    <ThemeProvider initialPreference="dark" userId="owner">
      <p>비공개 재료</p>
    </ThemeProvider>,
  );
  act(() => window.dispatchEvent(new Event('hankan:identity-cleared')));
  expect(screen.queryByText('비공개 재료')).not.toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute('data-theme', 'system');
});
// Catches a failed initial load being misreported as a genuinely empty fridge.
it('failed_initial_load_does_not_claim_the_fridge_is_empty', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: { code: 'internal', message: '잠시 후 다시 시도해 주세요.' } }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
    ),
  );
  render(<Fixture />);
  await screen.findByRole('alert');
  expect(screen.queryByText('냉장고의 첫 재료를 담아 보세요')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeEnabled();
});
