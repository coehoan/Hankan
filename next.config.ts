import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  // Include shared `next-server` traces, which the route-only `/*` key misses.
  // Match absolute tracing paths too; Vercel supplies environment values at runtime.
  outputFileTracingExcludes: { '*': ['**/.env*'] },
  logging: { incomingRequests: false },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self'; connect-src 'self'",
          },
        ],
      },
      { source: '/push-dedup.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};
export default config;
