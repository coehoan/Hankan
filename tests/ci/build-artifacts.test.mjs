import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glob, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkBuildArtifacts } from '../../scripts/release-production.mjs';

const functionManifest = '.vercel/output/functions/api/fridges/[fridgeId].func/.vc-config.json';
async function fixture(t, overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'hankan-build-artifacts-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const files = {
    '.next/next-server.js.nft.json': { files: ['../node_modules/@next/env/dist/index.js'] },
    '.next/next-minimal-server.js.nft.json': { files: ['../package.json'] },
    '.next/server/app/api/fridges/route.js.nft.json': { files: ['route.js'] },
    [functionManifest]: {
      runtime: 'nodejs24.x',
      handler: 'index.js',
      filePathMap: { 'index.js': '.next/server/app/api/fridges/route.js' },
    },
    '.vercel/output/functions/proxy.func/.vc-config.json': {
      runtime: 'edge',
      entrypoint: 'index.js',
    },
    ...overrides,
  };
  for (const [file, manifest] of Object.entries(files)) {
    if (manifest === undefined) continue;
    await mkdir(dirname(join(dir, file)), { recursive: true });
    await writeFile(join(dir, file), JSON.stringify(manifest));
  }
  return {
    read: (file) => readFile(join(dir, file), 'utf8'),
    list: (patterns) => glob(patterns, { cwd: dir }),
  };
}

test('checks_real_nested_manifests_and_accepts_runtime_dependencies_and_edge_functions', async (t) => {
  await checkBuildArtifacts(await fixture(t));
});
test('rejects_environment_references_in_real_nested_function_output', async (t) => {
  await assert.rejects(
    checkBuildArtifacts(
      await fixture(t, {
        [functionManifest]: {
          runtime: 'nodejs24.x',
          filePathMap: { 'config.txt': '.env.test.local' },
        },
      }),
    ),
    /environment file/i,
  );
});
test('rejects_environment_references_in_real_nested_route_traces', async (t) => {
  await assert.rejects(
    checkBuildArtifacts(
      await fixture(t, {
        '.next/server/app/api/fridges/route.js.nft.json': {
          files: ['../../../../../.env.example'],
        },
      }),
    ),
    /environment file/i,
  );
});
test('rejects_builds_without_any_function_manifests', async (t) => {
  await assert.rejects(
    checkBuildArtifacts(
      await fixture(t, {
        [functionManifest]: undefined,
        '.vercel/output/functions/proxy.func/.vc-config.json': undefined,
      }),
    ),
    /manifests are missing/i,
  );
});
for (const map of [[], { 'config.txt': 42 }]) {
  test('rejects_malformed_function_file_maps_' + JSON.stringify(map), async (t) => {
    await assert.rejects(
      checkBuildArtifacts(
        await fixture(t, {
          [functionManifest]: { runtime: 'nodejs24.x', filePathMap: map },
        }),
      ),
      /invalid build manifest/i,
    );
  });
}

for (const manifest of [42, [], { runtime: 'nodejs24.x', filePathMap: null }]) {
  test('rejects_invalid_function_manifest_shape_' + JSON.stringify(manifest), async (t) => {
    await assert.rejects(
      checkBuildArtifacts(await fixture(t, { [functionManifest]: manifest })),
      /invalid build manifest/i,
    );
  });
}
