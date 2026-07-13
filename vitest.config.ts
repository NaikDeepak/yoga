import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'node',
    // PGlite tests time out under parallel coverage load at the 5s default
    testTimeout: 30_000,
    // createTestDb() runs in beforeEach and hits the same coverage-load slowdown
    hookTimeout: 30_000,
    setupFiles: ['tests/setup.ts'],
    exclude: [...configDefaults.exclude, '**/.worktrees/**'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/data/**', 'src/actions/**'],
      exclude: ['src/lib/supabase/**'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
