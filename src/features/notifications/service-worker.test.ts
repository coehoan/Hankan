import { it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
function worker(saved: Response | null = null) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const cache = { match: vi.fn().mockResolvedValue(saved), put: vi.fn() };
  const fetch = vi.fn().mockResolvedValue({ ok: true, type: 'basic' }),
    open = vi.fn().mockResolvedValue(cache);
  const context = {
    URL,
    importScripts: vi.fn(),
    fetch,
    caches: { open, match: vi.fn(), keys: vi.fn().mockResolvedValue([]) },
    self: {
      location: { origin: 'https://hankan.test' },
      addEventListener: (name: string, fn: (event: unknown) => void) => {
        handlers[name] = fn;
      },
    },
    hankanPushDedup: {},
  };
  runInNewContext(readFileSync('public/sw.js', 'utf8'), context);
  return { handlers, fetch, open, cache };
}
function asset(body: string, cacheControl: string) {
  const response = new Response(body, { headers: { 'Cache-Control': cacheControl } });
  Object.defineProperty(response, 'type', { value: 'basic' });
  return response;
}
function requestStyle(sw: ReturnType<typeof worker>) {
  let response: Promise<Response> | undefined;
  sw.handlers.fetch({
    request: {
      url: 'https://hankan.test/_next/static/chunks/app.css',
      method: 'GET',
      mode: 'cors',
    },
    respondWith: (value: Promise<Response>) => {
      response = value;
    },
  });
  return response!;
}
it('revalidates_cached_development_css_instead_of_freezing_an_old_layout', async () => {
  const sw = worker(asset('old layout', 'no-cache, must-revalidate'));
  const fresh = asset('corrected layout', 'no-cache, must-revalidate');
  sw.fetch.mockResolvedValue(fresh);
  expect(await requestStyle(sw)).toBe(fresh);
  expect(sw.fetch).toHaveBeenCalledOnce();
  expect(sw.cache.put).toHaveBeenCalledOnce();
});
it('keeps_immutable_production_assets_cache_first', async () => {
  const saved = asset('hashed production asset', 'public, max-age=31536000, immutable');
  const sw = worker(saved);
  expect(await requestStyle(sw)).toBe(saved);
  expect(sw.fetch).not.toHaveBeenCalled();
});
it('does_not_store_a_no_store_asset', async () => {
  const sw = worker();
  sw.fetch.mockResolvedValue(asset('uncached asset', 'no-store'));
  await requestStyle(sw);
  expect(sw.cache.put).not.toHaveBeenCalled();
});
it('keeps_a_public_revalidation_asset_available_when_offline', async () => {
  const saved = asset('offline stylesheet', 'no-cache');
  const sw = worker(saved);
  sw.fetch.mockRejectedValue(new TypeError('offline'));
  expect(await requestStyle(sw)).toBe(saved);
});
it('private_pages_and_apis_never_enter_cache', async () => {
  const sw = worker();
  for (const path of [
    '/api/ingredients',
    '/api/notifications/x',
    '/api/receipts/x',
    '/fridges/x',
    '/recipes/x',
  ]) {
    let response: Promise<unknown> | undefined;
    sw.handlers.fetch({
      request: { url: 'https://hankan.test' + path, method: 'GET', mode: 'cors' },
      respondWith: (p: Promise<unknown>) => {
        response = p;
      },
    });
    expect(response).toBeUndefined();
  }
  expect(sw.open).not.toHaveBeenCalled();
});
it('navigation_uses_network_without_caching_document', async () => {
  const sw = worker();
  let response: Promise<unknown> | undefined;
  sw.handlers.fetch({
    request: { url: 'https://hankan.test/fridges/x', method: 'GET', mode: 'navigate' },
    respondWith: (p: Promise<unknown>) => {
      response = p;
    },
  });
  await response;
  expect(sw.fetch).toHaveBeenCalledOnce();
  expect(sw.open).not.toHaveBeenCalled();
});
