import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectBuildTraces } from 'next/dist/build/collect-build-traces.js';
import { trace } from 'next/dist/trace/index.js';
import nextConfig from '../../next.config.ts';

test('configured_tracing_keeps_runtime_files_but_excludes_environment_files_from_shared_server', async (t) => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  await mkdir(join(root, 'work'), { recursive: true });
  const dir = await mkdtemp(join(root, 'work', 'shared-server-tracing-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const distDir = join(dir, '.next');
  await mkdir(distDir);
  await writeFile(join(dir, '.env.example'), 'UNUSED_TEST_VALUE=placeholder\n');
  await writeFile(join(dir, 'runtime.json'), '{}');
  const handler = join(dir, 'handler.cjs');
  await writeFile(
    handler,
    "const fs = require('node:fs');\n" +
      "fs.readFileSync(__dirname + '/.env.example', 'utf8');\n" +
      "fs.readFileSync(__dirname + '/runtime.json', 'utf8');\n",
  );
  await collectBuildTraces({
    dir,
    config: { ...nextConfig, cacheHandler: handler },
    distDir,
    edgeRuntimeRoutes: {},
    staticPages: [],
    nextBuildSpan: trace('shared-server-tracing-test'),
    outputFileTracingRoot: root,
  });
  for (const name of ['next-server.js.nft.json', 'next-minimal-server.js.nft.json']) {
    const manifest = JSON.parse(await readFile(join(distDir, name), 'utf8'));
    assert.ok(manifest.files.includes('../runtime.json'), 'real runtime dependencies must remain');
    assert.equal(
      manifest.files.some((file) => /(^|[\\/])\.env/.test(file)),
      false,
      name + ' must not reference environment files excluded by .vercelignore',
    );
  }
});
