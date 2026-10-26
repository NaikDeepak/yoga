import type { NextConfig } from 'next';
import { clinicProfileForBuild } from './src/clinics/build-env';

const nextConfig: NextConfig = {
  // Overridable so a second dev server (e2e modules-off project) does not clash on .next/.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Which clinic this deployment is (src/clinics/). Inlined at build time so client components agree with the server;
  // a production build without CLINIC_PROFILE fails here (fail closed).
  env: { CLINIC_PROFILE: clinicProfileForBuild(process.env) },
  // PGlite (local mock DB) ships WASM assets that must not be bundled
  serverExternalPackages: ['@electric-sql/pglite'],
  // Dev only: lets a phone on the same Wi-Fi load the dev server (`npm run dev:phone`) to test
  // posture capture. Has no effect on production builds.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*'],
  // Client share links: the token is in the URL, so never send it on as a referrer or index it.
  // (Caching: the page is dynamic, so Next itself sends `private, no-cache, no-store`.)
  async headers() {
    return [{
      source: '/s/:token*',
      headers: [
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
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
