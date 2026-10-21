import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// End-to-end smoke tests (H5). They drive the real app in local mock mode: PGlite in `.local-db/`, mock login,
// local files in `public/uploads/`, canned AI. Mock mode refuses NODE_ENV=production, so this runs `next dev`.
// Own port so it never collides with a dev server you already have open on 3000.
const PORT = 3100;

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
  projects: [{ name: 'phone', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    env: { LOCAL_MOCK: 'true' },
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
