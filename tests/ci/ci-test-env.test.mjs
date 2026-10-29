import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from 'node:util';
import { createTestEnv } from '../../scripts/ci-test-env.mjs';
const status =
  'API_URL="http://127.0.0.1:54321"\nPUBLISHABLE_KEY="local-public"\nSERVICE_ROLE_KEY="local-admin"\nJWT_SECRET="must-not-copy"';
test('creates_only_the_loopback_configuration_needed_by_tests', () => {
  const env = parseEnv(createTestEnv(status));
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, 'http://127.0.0.1:54321');
  assert.equal(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'local-public');
  assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, 'local-admin');
  assert.equal(env.NEXT_PUBLIC_SITE_URL, 'http://127.0.0.1:3000');
  assert.equal(env.JWT_SECRET, undefined);
  assert.equal(env.OPENAI_API_KEY, undefined);
});
for (const url of [
  'https://production.supabase.co',
  'http://127.0.0.1.evil.test:54321',
  'not-a-url',
]) {
  test('refuses_nonlocal_test_url_' + url, () =>
    assert.throws(() => createTestEnv(status.replace('http://127.0.0.1:54321', url))),
  );
}
test('fails_when_status_has_no_service_key', () =>
  assert.throws(() => createTestEnv('API_URL=http://localhost:54321\nPUBLISHABLE_KEY=key')));
