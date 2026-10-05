import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PGlite (local mock DB) ships WASM assets that must not be bundled
  serverExternalPackages: ['@electric-sql/pglite'],
  // Dev only: lets a phone on the same Wi-Fi load the dev server (`npm run dev:phone`) to test
  // posture capture. Has no effect on production builds.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*'],
  // Client share links: the token is in the URL, so never send it on as a referrer, never index or cache.
  async headers() {
    return [{
      source: '/s/:token*',
      headers: [
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Cache-Control', value: 'private, no-store' },
      ],
    }];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
