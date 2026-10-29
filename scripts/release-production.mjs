import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';

const target = {
  GITHUB_ACTIONS: 'true',
  GITHUB_EVENT_NAME: 'push',
  GITHUB_REF: 'refs/heads/dev',
  GITHUB_REPOSITORY: 'coehoan/Hankan',
  SUPABASE_PROJECT_ID: 'wtwvmerpucfdodieawul',
  VERCEL_ORG_ID: 'team_IzPoeQVchAzgQstQ4lF48zg1',
  VERCEL_PROJECT_ID: 'prj_2ZphxQuQiaPo8vJ8Vn8AZ8Yyoqbt',
};
const databaseOrigin = 'https://' + target.SUPABASE_PROJECT_ID + '.supabase.co';
const siteOrigin = 'https://hankan-murex.vercel.app';
export function validateReleaseConfig(env) {
  for (const [name, expected] of Object.entries(target)) {
    if (env[name] !== expected)
      throw Error('Release target mismatch or missing configuration: ' + name);
  }
  for (const name of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD', 'VERCEL_TOKEN']) {
    if (!env[name]?.trim()) throw Error('Missing GitHub Actions secret: ' + name);
  }
}
async function checkBuildTarget(read) {
  let project, output, config;
  try {
    project = JSON.parse(await read('.vercel/project.json', 'utf8'));
    output = JSON.parse(await read('.vercel/output/config.json', 'utf8'));
    config = parseEnv(await read('.vercel/.env.production.local', 'utf8'));
  } catch {
    throw Error(
      'Production project, environment, or prebuilt output is missing/invalid. Database was not changed.',
    );
  }
  if (
    project.projectId !== target.VERCEL_PROJECT_ID ||
    project.orgId !== target.VERCEL_ORG_ID ||
    output.version !== 3
  )
    throw Error('Unexpected Vercel project or prebuilt output. Database was not changed.');
  const base = (value) => {
    try {
      const url = new URL(value);
      return url.pathname === '/' && !url.search && !url.hash ? url.origin : '';
    } catch {
      return '';
    }
  };
  if (
    base(config.NEXT_PUBLIC_SUPABASE_URL) !== databaseOrigin ||
    base(config.NEXT_PUBLIC_SITE_URL) !== siteOrigin ||
    (config.SUPABASE_SERVER_URL && base(config.SUPABASE_SERVER_URL) !== databaseOrigin)
  )
    throw Error(
      'Vercel production environment points to an unexpected database or site. Database was not changed.',
    );
}
function runChecked({ name, command, args, env }) {
  console.log('Production release: ' + name);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit', windowsHide: true });
    child.on('error', () => reject(Error('Could not start production step: ' + name)));
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(Error('Production step failed: ' + name + ' (exit ' + code + ')')),
    );
  });
}
export async function releaseProduction({
  env = process.env,
  run = runChecked,
  read = readFile,
} = {}) {
  validateReleaseConfig(env);
  const { SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, VERCEL_TOKEN, ...base } = env;
  const vercelEnv = { ...base };
  const databaseEnv = { ...base, SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD };
  const vercel = (name, args) =>
    run({
      name,
      command: 'vercel',
      // --scope can force a user lookup unsupported by team-scoped tokens.
      // The validated VERCEL_ORG_ID / VERCEL_PROJECT_ID already select the target.
      args: [...args, '--token', VERCEL_TOKEN],
      env: vercelEnv,
    });
  const supabase = (name, args) =>
    run({
      name,
      command: process.execPath,
      args: ['scripts/supabase.mjs', ...args],
      env: databaseEnv,
    });
  await vercel('pull', ['pull', '--yes', '--environment=production']);
  await vercel('build', ['build', '--prod', '--yes']);
  await checkBuildTarget(read);
  await supabase('link', ['link', '--project-ref', target.SUPABASE_PROJECT_ID, '--yes']);
  await supabase('dry-run', ['db', 'push', '--linked', '--dry-run']);
  await supabase('migrate', ['db', 'push', '--linked', '--yes']);
  await vercel('deploy', ['deploy', '--prebuilt', '--prod', '--yes']);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv[2] === '--check-config') {
      validateReleaseConfig(process.env);
      console.log('Production release configuration verified (values hidden).');
    } else if (process.argv[2] === '--execute') {
      await releaseProduction();
    } else {
      throw Error(
        'Use --check-config for validation. --execute is restricted to the dev push workflow.',
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Production release failed.');
    process.exitCode = 1;
  }
}
