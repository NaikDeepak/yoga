import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PGlite (local mock DB) ships WASM assets that must not be bundled
  serverExternalPackages: ['@electric-sql/pglite'],
  // Dev only: lets a phone on the same Wi-Fi load the dev server (`npm run dev:phone`) to test
  // posture capture. Has no effect on production builds.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
