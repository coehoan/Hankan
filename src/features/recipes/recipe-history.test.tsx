// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { RecipeJob } from './job-contracts';
import { RecipeHistory } from './recipe-history';

const finished: RecipeJob = {
  id: 'finished-job',
  fridgeId: 'fridge',
  status: 'complete',
  matches: [],
  ingredients: [],
  inventoryVersion: 'v1',
  today: '2026-11-10',
  createdAt: '2026-11-10T01:00:00Z',
  completedAt: '2026-11-10T01:01:00Z',
};
const pending: RecipeJob = { ...finished, id: 'pending-job', status: 'running', completedAt: null };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('shows the saved selection alongside old all-ingredient jobs', async () => {
  const selected = {
    ...finished,
    id: 'selected-job',
    selectedIngredientIds: ['tofu'],
    ingredients: [{ id: 'tofu', name: '두부' }],
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ data: [selected, finished] })),
  );
  render(<RecipeHistory timeZone="Asia/Seoul" />);
  expect(await screen.findByText('선택 재료: 두부')).toBeVisible();
  expect(screen.getByText('전체 재료로 추천')).toBeVisible();
});

it('confirms deletion, restores focus and ignores an older list response', async () => {
  let resolveOlder!: (response: Response) => void;
  const older = new Promise<Response>((resolve) => (resolveOlder = resolve));
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ data: [finished, pending] }))
    .mockReturnValueOnce(older)
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValue(Response.json({ data: [pending] }));
  vi.stubGlobal('fetch', fetchMock);
  render(<RecipeHistory timeZone="Asia/Seoul" />);

  const trigger = await screen.findByRole('button', { name: '저장된 요리 추천 내역 삭제' });
  expect(screen.getAllByRole('button', { name: /내역 삭제/ })).toHaveLength(1);
  trigger.focus();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: '취소' }));
  expect(trigger).toHaveFocus();
  expect(fetchMock).toHaveBeenCalledTimes(1);

  fireEvent(window, new Event('focus'));
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: '삭제하기' }));
  await screen.findByText('추천 내역을 삭제했어요.');
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/recipe-jobs/finished-job',
    expect.objectContaining({ method: 'DELETE' }),
  );
  await act(async () => resolveOlder(Response.json({ data: [finished, pending] })));
  expect(screen.queryByRole('link', { name: '추천 보기' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '진행 상태 보기' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '추천 내역' })).toHaveFocus();
});

it('keeps the recommendation and the confirmation open if saving fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ data: [finished] }))
      .mockResolvedValueOnce(new Response(null, { status: 500 })),
  );
  render(<RecipeHistory timeZone="Asia/Seoul" />);
  fireEvent.click(await screen.findByRole('button', { name: '저장된 요리 추천 내역 삭제' }));
  fireEvent.click(screen.getByRole('button', { name: '삭제하기' }));

  await screen.findByRole('alert');
  expect(screen.getByRole('dialog', { name: '추천 내역 삭제' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: '삭제하기' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '취소' }));
  expect(screen.getByRole('link', { name: '추천 보기' })).toBeInTheDocument();
});
