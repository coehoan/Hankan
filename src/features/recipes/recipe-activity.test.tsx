// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RecipeActivity } from './recipe-activity';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('announces_completion_after_leaving_the_recipe_screen_without_exposing_a_foreign_job', async () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  let status = 'running';
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ data: [{ id, status }] })),
  );
  render(<RecipeActivity />);
  expect(await screen.findByText(/요리 추천이 진행 중이에요/)).toBeVisible();
  status = 'complete';
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(await screen.findByText(/요리 추천이 준비됐어요/)).toBeVisible();
  expect(screen.getByRole('link', { name: '결과 보기' })).toHaveAttribute(
    'href',
    '/recipes/jobs/' + id,
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ data: [] })),
  );
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(screen.queryByText(/요리 추천이 준비됐어요/)).not.toBeInTheDocument();
});
