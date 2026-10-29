import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withoutRootEnvironmentFiles } from '../../scripts/build-environment.mjs';

async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'hankan-build-environment-test-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const root = join(base, 'repo');
  await mkdir(join(root, '.vercel'), { recursive: true });
  const files = {
    '.env': 'ROOT=test-only\n',
    '.env.example': 'EXAMPLE=test-only\n',
    '.env.local': 'LOCAL=test-only\n',
    '.env.test.local': 'TEST=test-only\n',
    '.vercel/.env.production.local': 'PRODUCTION=test-only\n',
    'package.json': '{}',
  };
  for (const [name, contents] of Object.entries(files)) await writeFile(join(root, name), contents);
  return { base, root, files };
}

test('hides_root_env_files_from_packaging_and_restores_them_after_success', async (t) => {
  const { base, root, files } = await fixture(t);
  const value = await withoutRootEnvironmentFiles(
    async () => {
      for (const name of ['.env', '.env.example', '.env.local', '.env.test.local'])
        await assert.rejects(readFile(join(root, name)), { code: 'ENOENT' });
      assert.equal(
        await readFile(join(root, '.vercel/.env.production.local'), 'utf8'),
        files['.vercel/.env.production.local'],
      );
      assert.equal(await readFile(join(root, 'package.json'), 'utf8'), '{}');
      return 'built';
    },
    { root },
  );
  assert.equal(value, 'built');
  for (const [name, contents] of Object.entries(files))
    assert.equal(await readFile(join(root, name), 'utf8'), contents);
  assert.deepEqual(await readdir(base), ['repo']);
});

test('restores_all_root_env_files_when_the_build_fails', async (t) => {
  const { base, root, files } = await fixture(t);
  const failure = Error('build failed');
  await assert.rejects(
    withoutRootEnvironmentFiles(
      async () => {
        throw failure;
      },
      { root },
    ),
    (error) => error === failure,
  );
  for (const [name, contents] of Object.entries(files))
    assert.equal(await readFile(join(root, name), 'utf8'), contents);
  assert.deepEqual(await readdir(base), ['repo']);
});

test('preserves_both_files_if_a_build_recreates_an_env_file', async (t) => {
  const { base, root, files } = await fixture(t);
  await assert.rejects(
    withoutRootEnvironmentFiles(
      async () => {
        await writeFile(join(root, '.env.local'), 'NEW=test-only\n');
      },
      { root },
    ),
    /Could not restore/,
  );
  assert.equal(await readFile(join(root, '.env.local'), 'utf8'), 'NEW=test-only\n');
  const backup = (await readdir(base)).find((name) => name.startsWith('.hankan-build-env-'));
  assert.ok(backup);
  assert.equal(await readFile(join(base, backup, '.env.local'), 'utf8'), files['.env.local']);
  assert.equal(await readFile(join(root, '.env.test.local'), 'utf8'), files['.env.test.local']);
});

test('does_not_move_env_named_directories_or_require_a_backup_without_env_files', async (t) => {
  const base = await mkdtemp(join(tmpdir(), 'hankan-build-environment-test-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const root = join(base, 'repo');
  await mkdir(join(root, '.env.cache'), { recursive: true });
  assert.equal(
    await withoutRootEnvironmentFiles(async () => (await readdir(root))[0], { root }),
    '.env.cache',
  );
  assert.deepEqual(await readdir(base), ['repo']);
});
