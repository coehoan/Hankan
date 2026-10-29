import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

Object.assign(process.env, loadEnv('test', process.cwd(), ['NEXT_PUBLIC_', 'SUPABASE_']));

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    clearMocks: true,
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
