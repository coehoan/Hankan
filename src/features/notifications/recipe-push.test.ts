import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function setup() {
  const handlers: Record<string, (e: unknown) => void> = {},
    showNotification = vi.fn(),
    openWindow = vi.fn(),
    seen = new Set();
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    URL,
    importScripts: vi.fn(),
    self: {
      location: { origin: 'https://hankan.test' },
      addEventListener: (n: string, f: (e: unknown) => void) => {
        handlers[n] = f;
      },
      registration: { showNotification },
      clients: { matchAll: async () => [], openWindow },
    },
    hankanPushDedup: {
      currentUser: async () => 'user',
      claimNotificationDisplay: async (id: string) => {
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      },
    },
  });
  return { handlers, showNotification, openWindow };
}
async function push(sw: ReturnType<typeof setup>, payload: unknown) {
  let task: Promise<unknown> | undefined;
  sw.handlers.push({
    data: { json: () => payload },
    waitUntil: (p: Promise<unknown>) => {
      task = p;
    },
  });
  await task;
}
it('displays_a_recipe_completion_once_and_opens_its_saved_result', async () => {
  const sw = setup(),
    payload = {
      notificationId: 'user:recipe:' + id,
      recipeJobId: id,
      url: '/recipes/jobs/' + id,
      body: '추천이 준비됐어요.',
    };
  await push(sw, payload);
  await push(sw, payload);
  expect(sw.showNotification).toHaveBeenCalledTimes(1);
  expect(sw.showNotification.mock.calls[0][0]).toBe('한칸 · 요리 추천 완료');
  let task: Promise<unknown> | undefined;
  sw.handlers.notificationclick({
    notification: { close: vi.fn(), data: { url: payload.url } },
    waitUntil: (p: Promise<unknown>) => {
      task = p;
    },
  });
  await task;
  expect(sw.openWindow).toHaveBeenCalledWith('https://hankan.test' + payload.url);
});
it.each([
  '/recipes/jobs/' + id + '?redirect=https://evil.test',
  'https://evil.test/recipes/jobs/' + id,
  '/recipes/jobs/../account',
])('rejects_invalid_recipe_path_%s', async (url) => {
  const sw = setup();
  await push(sw, { notificationId: 'user:recipe:' + id, recipeJobId: id, url });
  expect(sw.showNotification).not.toHaveBeenCalled();
});
it('rejects_foreign_users_and_mismatched_job_ids_but_keeps_daily_digests', async () => {
  const sw = setup();
  await push(sw, {
    notificationId: 'other:recipe:' + id,
    recipeJobId: id,
    url: '/recipes/jobs/' + id,
  });
  await push(sw, {
    notificationId: 'user:recipe:' + id,
    recipeJobId: 'other',
    url: '/recipes/jobs/' + id,
  });
  expect(sw.showNotification).not.toHaveBeenCalled();
  await push(sw, { notificationId: 'user:2026-11-06', digestId: id, url: '/notifications/' + id });
  expect(sw.showNotification).toHaveBeenCalledTimes(1);
});
