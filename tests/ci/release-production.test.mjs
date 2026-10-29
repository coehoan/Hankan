import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseProduction, validateReleaseConfig } from '../../scripts/release-production.mjs';

const env = {
  GITHUB_ACTIONS: 'true',
  GITHUB_EVENT_NAME: 'push',
  GITHUB_REF: 'refs/heads/dev',
  GITHUB_REPOSITORY: 'coehoan/Hankan',
  SUPABASE_PROJECT_ID: 'wtwvmerpucfdodieawul',
  VERCEL_ORG_ID: 'team_IzPoeQVchAzgQstQ4lF48zg1',
  VERCEL_PROJECT_ID: 'prj_2ZphxQuQiaPo8vJ8Vn8AZ8Yyoqbt',
  SUPABASE_ACCESS_TOKEN: 'test-db-access-token',
  SUPABASE_DB_PASSWORD: 'test-db-password',
  VERCEL_TOKEN: 'test-vercel-token',
  PATH: '/test-tools',
};
const files = {
  '.vercel/project.json': JSON.stringify({
    projectId: env.VERCEL_PROJECT_ID,
    orgId: env.VERCEL_ORG_ID,
  }),
  '.vercel/.env.production.local':
    'NEXT_PUBLIC_SUPABASE_URL=https://wtwvmerpucfdodieawul.supabase.co\nNEXT_PUBLIC_SITE_URL=https://hankan-murex.vercel.app\n',
  '.vercel/output/config.json': '{"version":3}',
};
function harness({ fail, overrides = {} } = {}) {
  const calls = [];
  return {
    calls,
    options: {
      env,
      run: async (command) => {
        calls.push(command);
        if (command.name === fail) throw Error('simulated ' + fail + ' failure');
      },
      read: async (file) => {
        const value = { ...files, ...overrides }[file];
        if (value === undefined) throw Error('Missing build output');
        return value;
      },
    },
  };
}
test('builds_before_migrating_and_deploys_prebuilt_only_after_migration', async () => {
  const h = harness();
  await releaseProduction(h.options);
  assert.deepEqual(
    h.calls.map((c) => c.name),
    ['pull', 'build', 'link', 'dry-run', 'migrate', 'deploy'],
  );
  assert.ok(h.calls.find((c) => c.name === 'deploy').args.includes('--prebuilt'));
  assert.ok(h.calls.find((c) => c.name === 'migrate').args.includes('--linked'));
  assert.ok(h.calls.find((c) => c.name === 'migrate').args.includes('--yes'));
});
for (const [key, value] of Object.entries({
  GITHUB_ACTIONS: '',
  GITHUB_EVENT_NAME: 'pull_request',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_REPOSITORY: 'someone/Hankan',
  SUPABASE_PROJECT_ID: 'another-project',
  VERCEL_ORG_ID: 'another-team',
  VERCEL_PROJECT_ID: 'another-project',
  SUPABASE_ACCESS_TOKEN: '',
  SUPABASE_DB_PASSWORD: '  ',
  VERCEL_TOKEN: '',
})) {
  test('blocks_all_commands_for_invalid_' + key, async () => {
    const h = harness();
    await assert.rejects(releaseProduction({ ...h.options, env: { ...env, [key]: value } }));
    assert.equal(h.calls.length, 0);
  });
}
test('configuration_errors_never_print_credential_values', () => {
  assert.throws(
    () => validateReleaseConfig({ ...env, SUPABASE_PROJECT_ID: 'wrong' }),
    (error) =>
      !error.message.includes(env.SUPABASE_DB_PASSWORD) &&
      !error.message.includes(env.VERCEL_TOKEN),
  );
});
for (const stage of ['pull', 'build', 'link', 'dry-run', 'migrate', 'deploy']) {
  test(stage + '_failure_stops_all_following_commands_without_rollback_or_reset', async () => {
    const h = harness({ fail: stage });
    await assert.rejects(releaseProduction(h.options), /simulated/);
    const order = ['pull', 'build', 'link', 'dry-run', 'migrate', 'deploy'];
    assert.deepEqual(
      h.calls.map((c) => c.name),
      order.slice(0, order.indexOf(stage) + 1),
    );
  });
}
for (const [label, overrides] of Object.entries({
  project: { '.vercel/project.json': '{"projectId":"wrong","orgId":"wrong"}' },
  database: {
    '.vercel/.env.production.local':
      'NEXT_PUBLIC_SUPABASE_URL=https://another.supabase.co\nNEXT_PUBLIC_SITE_URL=https://hankan-murex.vercel.app',
  },
  site: {
    '.vercel/.env.production.local':
      'NEXT_PUBLIC_SUPABASE_URL=https://wtwvmerpucfdodieawul.supabase.co\nNEXT_PUBLIC_SITE_URL=http://localhost:3000',
  },
  server: {
    '.vercel/.env.production.local':
      files['.vercel/.env.production.local'] + 'SUPABASE_SERVER_URL=http://127.0.0.1:54321\n',
  },
  missing_output: { '.vercel/output/config.json': undefined },
  invalid_output: { '.vercel/output/config.json': '{"version":2}' },
})) {
  test('does_not_touch_database_when_built_' + label + '_is_wrong', async () => {
    const h = harness({ overrides });
    await assert.rejects(releaseProduction(h.options));
    assert.deepEqual(
      h.calls.map((c) => c.name),
      ['pull', 'build'],
    );
  });
}
test('migration_credentials_never_reach_vercel_and_vercel_token_never_reaches_supabase', async () => {
  const h = harness();
  await releaseProduction(h.options);
  for (const call of h.calls) {
    if (['link', 'dry-run', 'migrate'].includes(call.name)) {
      assert.equal(call.env.SUPABASE_ACCESS_TOKEN, env.SUPABASE_ACCESS_TOKEN);
      assert.equal(call.env.SUPABASE_DB_PASSWORD, env.SUPABASE_DB_PASSWORD);
      assert.equal(call.env.VERCEL_TOKEN, undefined);
    } else {
      assert.equal(call.env.SUPABASE_ACCESS_TOKEN, undefined);
      assert.equal(call.env.SUPABASE_DB_PASSWORD, undefined);
    }
  }
});
