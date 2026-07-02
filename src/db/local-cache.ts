import type { Db } from './types';

// Shared handle to the local mock DB. It lives on globalThis because the dev
// server re-evaluates modules on HMR, and a second file-backed PGlite instance
// on the same data dir fails to acquire the lock. Kept free of PGlite imports
// so the prod path (src/db/client.ts) can read it without pulling in PGlite.
export type LocalDbCache = { db: Db; ready: Promise<void> };

type GlobalWithCache = typeof globalThis & { __yogaLocalDb?: LocalDbCache };

export function getLocalDbCache(): LocalDbCache | undefined {
  return (globalThis as GlobalWithCache).__yogaLocalDb;
}

export function setLocalDbCache(cache: LocalDbCache): void {
  (globalThis as GlobalWithCache).__yogaLocalDb = cache;
}
