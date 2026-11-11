// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { Ingredient } from '@/features/inventory/contracts';
import { RecipeIngredientPicker } from './recipe-ingredient-picker';
const item = (id: string, name = id): Ingredient => ({
  id,
  name,
  normalizedName: name,
  fridgeId: 'fridge',
  expiresOn: '2099-01-01',
  remainingPercent: 100,
  storage: 'fridge',
  version: 1,
  createdAt: '',
  updatedAt: '',
  createdBy: '',
  updatedBy: '',
});
afterEach(cleanup);

it('paginates by 12 and restores the selected draft after toggling modes', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(
    <RecipeIngredientPicker
      ingredients={Array.from({ length: 25 }, (_, i) => item(`재료${String(i).padStart(2, '0')}`))}
      today="2026-11-11"
      disabled={false}
      loading={false}
      actionLabel="요리 추천 받기"
      onSubmit={onSubmit}
    />,
  );
  await user.click(screen.getByRole('radio', { name: '재료 골라서' }));
  expect(screen.getAllByRole('button', { name: / 선택$/ })).toHaveLength(12);
  await user.click(screen.getByRole('button', { name: '재료00 선택' }));
  await user.click(screen.getByRole('button', { name: '재료 더 보기' }));
  expect(screen.getAllByRole('button', { name: / 선택$/ })).toHaveLength(24);
  await user.click(screen.getByRole('radio', { name: '전체 재료' }));
  await user.click(screen.getByRole('radio', { name: '재료 골라서' }));
  expect(screen.getByRole('button', { name: '재료00 선택' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

it('removes unusable selections with feedback without switching to all-ingredients mode', async () => {
  const user = userEvent.setup();
  const props = {
    today: '2026-11-11',
    disabled: false,
    loading: false,
    actionLabel: '요리 추천 받기',
    onSubmit: vi.fn(),
  };
  const view = render(
    <RecipeIngredientPicker {...props} ingredients={[item('tofu', '두부'), item('egg', '계란')]} />,
  );
  await user.click(screen.getByRole('radio', { name: '재료 골라서' }));
  await user.click(screen.getByRole('button', { name: '두부 선택' }));
  view.rerender(
    <RecipeIngredientPicker
      {...props}
      ingredients={[{ ...item('tofu', '두부'), remainingPercent: 0 }, item('egg', '계란')]}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    '사용할 수 없게 된 재료를 선택에서 제외했어요.',
  );
  expect(screen.getByRole('radio', { name: '재료 골라서' })).toBeChecked();
  expect(screen.getByRole('button', { name: '선택한 재료로 추천받기' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: '두부 선택' })).toBeNull();
});
