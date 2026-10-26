import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// End-to-end smoke tests (H5). They drive the real app in local mock mode: PGlite in `.local-db/`, mock login,
// local files in `public/uploads/`, canned AI. Mock mode refuses NODE_ENV=production, so this runs `next dev`.
// Own port so it never collides with a dev server you already have open on 3000.
const PORT = 3100;
// Second server for e2e/modules-off.spec.ts: every module switched off. Own database folder and build folder,
// because two `next dev` in one folder clash on `.next/` and two PGlite processes corrupt one `.local-db/`.
const OFF_PORT = 3101;

// Which clinic profile the main server (3100) runs; unset means pawar. Anything else gets its own build and
// database folders (a `.next/` built for pawar has pawar inlined in its client chunks) and never reuses a server
// that is already running, which could be a pawar one.
const PROFILE = process.env.CLINIC_PROFILE || 'pawar';
const OTHER_CLINIC = PROFILE !== 'pawar';

export default defineConfig({
  testDir: 'e2e',
  // Outside the repo: `next dev` watches the project folder, and traces written into it during a run
  // set off hundreds of rebuilds that stall server actions.
  outputDir: path.join(os.tmpdir(), 'yoga-e2e-results'),
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // First request to each page compiles it in dev mode, which can take a while on a cold CI runner.
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    navigationTimeout: 120_000,
  },
  // The clinic uses the app on phones, so test at phone size.
  projects: [
    { name: 'phone', testIgnore: /modules-off\.spec\.ts/, use: { ...devices['Pixel 7'] } },
    {
      name: 'phone-modules-off',
      testMatch: /modules-off\.spec\.ts/,
      use: { ...devices['Pixel 7'], baseURL: `http://localhost:${OFF_PORT}` },
    },
  ],
  // Playwright starts every entry whatever --project is passed, so both servers run together.
  webServer: [
    {
      command: `npx next dev -p ${PORT}`,
      url: `http://localhost:${PORT}/login`,
      env: {
        LOCAL_MOCK: 'true',
        ...(OTHER_CLINIC
          ? { CLINIC_PROFILE: PROFILE, NEXT_DIST_DIR: `.next-${PROFILE}`, LOCAL_DB_DIR: `.local-db-${PROFILE}` }
          : {}),
      },
      reuseExistingServer: !process.env.CI && !OTHER_CLINIC,
      timeout: 240_000,
    },
    {
      command: `npx next dev -p ${OFF_PORT}`,
      url: `http://localhost:${OFF_PORT}/login`,
      env: {
        LOCAL_MOCK: 'true',
        LOCAL_DB_DIR: '.local-db-modules-off',
        NEXT_DIST_DIR: '.next-modules-off',
        FEATURE_POSTURE: 'false',
        FEATURE_FLEXIBILITY: 'false',
        FEATURE_AI: 'false',
        FEATURE_SHARE_LINKS: 'false',
        FEATURE_CHECKINS: 'false',
        FEATURE_FEES: 'false',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
  ],
});
