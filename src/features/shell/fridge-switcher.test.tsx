// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { FridgeSwitcher } from './fridge-switcher';
const fridges = [
  { id: 'owned', name: '우리집', role: 'owner' as const },
  { id: 'shared', name: '함께 냉장고', role: 'member' as const },
];
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('selected_name_and_role_are_inside_the_trigger_as_separate_badge', () => {
  render(<FridgeSwitcher fridges={fridges} selectedId="owned" onSelect={() => {}} />);
  const trigger = screen.getByRole('combobox', { name: '냉장고 선택' });
  expect(within(trigger).getByText('우리집')).toBeVisible();
  expect(within(trigger).getByText('내 소유')).toHaveClass('fridge-role-badge');
  fireEvent.click(trigger);
  expect(screen.getByRole('option', { name: '함께 냉장고 · 함께 관리' })).toBeVisible();
});
it('keyboard_selection_escape_and_disabled_state_preserve_focus_and_value', async () => {
  const user = userEvent.setup(),
    select = vi.fn(),
    view = render(<FridgeSwitcher fridges={fridges} selectedId="owned" onSelect={select} />);
  const trigger = screen.getByRole('combobox', { name: '냉장고 선택' });
  await user.click(trigger);
  await user.keyboard('{ArrowDown}{Enter}');
  expect(select).toHaveBeenCalledWith('shared');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  select.mockClear();
  await user.click(trigger);
  await user.keyboard('{ArrowDown}{Escape}');
  expect(select).not.toHaveBeenCalled();
  expect(trigger).toHaveFocus();
  view.rerender(<FridgeSwitcher fridges={fridges} selectedId="owned" onSelect={select} disabled />);
  expect(trigger).toBeDisabled();
});
it('long_list_keeps_keyboard_and_initial_active_option_inside_the_scroll_viewport', async () => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.getAttribute('role') === 'listbox' ? 288 : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.getAttribute('role') === 'option' ? 48 : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.getAttribute('role') === 'option'
      ? Array.from(this.parentElement!.children).indexOf(this) * 48
      : 0;
  });
  const many = Array.from({ length: 10 }, (_, index) => ({
      id: String(index),
      name: '냉장고 ' + index,
      role: 'owner' as const,
    })),
    user = userEvent.setup(),
    view = render(<FridgeSwitcher fridges={many} selectedId="0" onSelect={() => {}} />);
  function visibleOption(index: number) {
    const list = screen.getByRole('listbox'),
      option = screen.getByRole('option', { name: '냉장고 ' + index + ' · 내 소유' });
    expect(option.offsetTop).toBeGreaterThanOrEqual(list.scrollTop);
    expect(option.offsetTop + option.offsetHeight).toBeLessThanOrEqual(
      list.scrollTop + list.clientHeight,
    );
  }
  await user.click(screen.getByRole('combobox'));
  await user.keyboard('{End}');
  visibleOption(9);
  await user.keyboard('{Home}');
  visibleOption(0);
  await user.keyboard('{Escape}');
  view.rerender(<FridgeSwitcher fridges={many} selectedId="9" onSelect={() => {}} />);
  await user.click(screen.getByRole('combobox'));
  visibleOption(9);
});
