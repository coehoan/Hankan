// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RecipeActivity } from './recipe-activity';

vi.mock('next/link', () => ({
  default: ({ href, onNavigate, ...props }: ComponentProps<typeof import('next/link').default>) => (
    <a
      {...props}
      href={String(href)}
      onClick={(event) => {
        event.preventDefault();
        onNavigate?.({ preventDefault: () => {} });
        window.history.pushState(null, '', String(href));
      }}
    />
  ),
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it.each(['complete', 'failed'])(
  'hides progress once after 3 seconds but keeps %s visible',
  async (outcome) => {
    vi.useFakeTimers();
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    let status = 'queued';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ data: [{ id, status }] })),
    );
    await act(async () => {
      render(<RecipeActivity />);
    });
    expect(screen.getByText('요리 추천이 진행 중이에요')).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    status = 'running';
    await act(async () => window.dispatchEvent(new Event('focus')));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(screen.getByText('요리 추천이 진행 중이에요')).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    status = outcome;
    await act(async () => window.dispatchEvent(new Event('focus')));
    const message = outcome === 'complete' ? '요리 추천이 준비됐어요' : '요리 추천에 실패했어요';
    expect(screen.getByText(message)).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByText(message)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '요리 추천 알림 닫기' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  },
);
it.each(['complete', 'failed'])(
  'keeps %s notification after manually closing progress',
  async (outcome) => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    let status = 'running';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ data: [{ id, status }] })),
    );
    render(<RecipeActivity />);
    await screen.findByText('요리 추천이 진행 중이에요');
    fireEvent.click(screen.getByRole('button', { name: '요리 추천 알림 닫기' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    status = outcome;
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(
      await screen.findByText(
        outcome === 'complete' ? '요리 추천이 준비됐어요' : '요리 추천에 실패했어요',
      ),
    ).toBeVisible();
  },
);

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
  expect(screen.getByRole('link')).toHaveAttribute('href', '/recipes/jobs/' + id);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ data: [] })),
  );
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(screen.queryByText(/요리 추천이 준비됐어요/)).not.toBeInTheDocument();
});

it('consumes only the opened completion when navigating to the result and back', async () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const nextId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const origin = window.location.pathname;
  let jobs = [{ id, status: 'running' }];
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ data: jobs })),
  );

  render(<RecipeActivity />);
  expect(await screen.findByText(/요리 추천이 진행 중이에요/)).toBeVisible();

  jobs = [{ id, status: 'complete' }];
  await act(async () => window.dispatchEvent(new Event('focus')));
  fireEvent.click(screen.getByRole('link'));
  expect(window.location.pathname).toBe('/recipes/jobs/' + id);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();

  window.history.back();
  await waitFor(() => expect(window.location.pathname).toBe(origin));
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(screen.queryByRole('link')).not.toBeInTheDocument();

  jobs = [{ id: nextId, status: 'running' }, ...jobs];
  await act(async () => window.dispatchEvent(new Event('focus')));
  jobs[0] = { id: nextId, status: 'complete' };
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(screen.getByRole('link', { name: '요리 추천이 준비됐어요' })).toHaveAttribute(
    'href',
    '/recipes/jobs/' + nextId,
  );
});
