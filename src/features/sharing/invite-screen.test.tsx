// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InviteScreen } from './invite-screen';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {} }) }));
const token = 'a'.repeat(43),
  info = {
    fridgeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    fridgeName: '우리집 냉장고',
    role: 'member',
    state: 'valid',
  };
const reply = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify(
      status === 200 ? { data } : { error: { code: 'conflict', message: '이미 사용된 초대예요.' } },
    ),
    { status },
  );
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('explicit invitation consent', () => {
  it('opening_an_invite_only_inspects_without_joining', async () => {
    let posts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') posts++;
        return Promise.resolve(reply(info));
      }),
    );
    render(<InviteScreen token={token} />);
    await screen.findByRole('heading', { name: '우리집 냉장고' });
    expect(screen.getByText(/추가.*수정.*삭제/)).toBeVisible();
    expect(posts).toBe(0);
  });
  it('explicit_accept_sends_one_request_and_shows_joined_state', async () => {
    let finish!: (response: Response) => void;
    let posts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'POST'
          ? (posts++,
            new Promise<Response>((resolve) => {
              finish = resolve;
            }))
          : Promise.resolve(reply(info)),
      ),
    );
    render(<InviteScreen token={token} />);
    const join = await screen.findByRole('button', { name: '이 냉장고에 참여' });
    fireEvent.click(join);
    fireEvent.click(join);
    expect(posts).toBe(1);
    await act(async () =>
      finish(reply({ id: info.fridgeId, name: info.fridgeName, role: 'member' })),
    );
    expect(screen.getByRole('status')).toHaveTextContent('참여했어요');
  });
  it.each([
    ['expired', '만료'],
    ['revoked', '취소'],
    ['used', '사용'],
  ])('does_not_offer_join_for_%s', (state, word) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(reply({ ...info, state }))),
    );
    render(<InviteScreen token={token} />);
    return waitFor(() => {
      expect(screen.getByText(new RegExp(word + '된 초대'))).toBeVisible();
      expect(screen.queryByRole('button', { name: '이 냉장고에 참여' })).not.toBeInTheDocument();
    });
  });
  it('already_member_opens_fridge_without_consuming_an_invite', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(reply({ ...info, state: 'already_member' }))),
    );
    render(<InviteScreen token={token} />);
    expect(await screen.findByRole('link', { name: '냉장고 열기' })).toHaveAttribute(
      'href',
      '/fridges/' + info.fridgeId,
    );
    expect(screen.queryByRole('button', { name: '이 냉장고에 참여' })).not.toBeInTheDocument();
  });
  it('failed_accept_keeps_the_permission_explanation_and_safe_error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
        Promise.resolve(init?.method === 'POST' ? reply(null, 409) : reply(info)),
      ),
    );
    render(<InviteScreen token={token} />);
    fireEvent.click(await screen.findByRole('button', { name: '이 냉장고에 참여' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('이미 사용된 초대');
    expect(screen.getByRole('heading', { name: '우리집 냉장고' })).toBeVisible();
  });
});
