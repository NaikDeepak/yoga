import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PGlite (local mock DB) ships WASM assets that must not be bundled
  serverExternalPackages: ['@electric-sql/pglite'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
