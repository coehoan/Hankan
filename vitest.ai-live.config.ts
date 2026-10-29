import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
// Only this opt-in config loads the OpenAI key. Ordinary tests never call OpenAI.
Object.assign(process.env, loadEnv('development', process.cwd(), ['OPENAI_']));
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/ai-live.test.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
  },
});
