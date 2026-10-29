import { describe, expect, it } from 'vitest';
import { readLocalTestConfig } from '../../../tests/support/db';

const keys = {
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-public-fixture',
  SUPABASE_SERVICE_ROLE_KEY: 'local-admin-fixture',
};
describe('local administration boundary', () => {
  it('permits_only_the_explicit_loopback_test_service', () => {
    expect(
      readLocalTestConfig({ ...keys, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' }).url,
    ).toBe('http://127.0.0.1:54321');
  });
  it.each([
    'https://production.supabase.co',
    'http://127.0.0.1.attacker.test:54321',
    'http://127.0.0.1@attacker.test',
    'http://0.0.0.0:54321',
  ])('rejects_remote_administration_%s', (url) => {
    expect(() => readLocalTestConfig({ ...keys, NEXT_PUBLIC_SUPABASE_URL: url })).toThrowError(
      /LOCAL_TEST_ONLY/,
    );
  });
  it('rejects_incomplete_test_credentials', () => {
    expect(() =>
      readLocalTestConfig({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' }),
    ).toThrowError(/LOCAL_TEST_CONFIG/);
  });
});
