import { link, mkdtemp, readdir, rename, rmdir, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export async function withoutRootEnvironmentFiles(build, { root = process.cwd() } = {}) {
  root = resolve(root);
  // @vercel/next adds these root files to every function independently of NFT excludes.
  const files = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && (entry.name === '.env' || entry.name.startsWith('.env.')))
    .map((entry) => entry.name);
  if (!files.length) return build();
  // A sibling stays on the same filesystem and outside the project's tracing/upload root.
  const backup = await mkdtemp(join(dirname(root), '.hankan-build-env-'));
  const moved = [];
  try {
    for (const name of files) {
      await rename(join(root, name), join(backup, name));
      moved.push(name);
    }
    return await build();
  } finally {
    const failures = [];
    for (const name of moved) {
      try {
        // link fails atomically if a build recreated the destination; never overwrite it.
        await link(join(backup, name), join(root, name));
        await unlink(join(backup, name));
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length)
      throw Error('Could not restore build environment files; originals preserved at ' + backup, {
        cause: failures[0],
      });
    await rmdir(backup);
  }
}
