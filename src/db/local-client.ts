import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema';
import type { Db } from './types';
import { getLocalDbCache, setLocalDbCache, type LocalDbCache } from './local-cache';
import { seedMockData } from './seed-mock';

export const LOCAL_DB_DIR = '.local-db';

// Only imported dynamically from src/instrumentation.ts when local mock mode
// is on; the prod bundle never loads PGlite.
export function getLocalDb(): LocalDbCache {
  let cache = getLocalDbCache();
  if (!cache) {
    const client = new PGlite(LOCAL_DB_DIR);
    const pgliteDb = drizzle(client, { schema });
    const db = pgliteDb as unknown as Db;
    const ready = migrate(pgliteDb, { migrationsFolder: 'drizzle' }).then(() => seedMockData(db));
    cache = { db, ready };
    setLocalDbCache(cache);
  }
  return cache;
}
