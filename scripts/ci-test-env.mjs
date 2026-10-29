import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';

export function createTestEnv(statusOutput) {
  const status = parseEnv(statusOutput);
  const url = new URL(status.API_URL);
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !['http:', 'https:'].includes(url.protocol)
  )
    throw Error('Local Supabase URL required');
  const key = status.PUBLISHABLE_KEY || status.ANON_KEY;
  if (!key || !status.SERVICE_ROLE_KEY) throw Error('Local Supabase keys required');
  return (
    Object.entries({
      NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000',
      NEXT_PUBLIC_SUPABASE_URL: url.origin,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
      SUPABASE_SERVER_URL: url.origin,
    })
      .map(([name, value]) => name + '=' + JSON.stringify(value))
      .join('\n') + '\n'
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.env.GITHUB_ACTIONS !== 'true') throw Error('CI only');
    const status = execFileSync(
      process.execPath,
      ['scripts/supabase.mjs', 'status', '--output', 'env'],
      { encoding: 'utf8', stdio: 'pipe', windowsHide: true },
    );
    await writeFile('.env.test.local', createTestEnv(status), { mode: 0o600, flag: 'wx' });
    console.log('Created loopback-only test configuration (values hidden).');
  } catch {
    console.error(
      'CI test configuration could not be generated. Check local services and existing test env file. Values were not logged.',
    );
    process.exitCode = 1;
  }
}
