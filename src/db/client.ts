import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import type { Db } from './types';
import { isLocalMock } from '@/lib/local-mock';
import { getLocalDbCache } from './local-cache';

let _db: Db | undefined;

export function getDb(): Db {
  if (isLocalMock()) {
    const cache = getLocalDbCache();
    if (!cache) {
      throw new Error(
        'Local mock DB not initialised — src/instrumentation.ts must run before the first request',
      );
    }
    return cache.db;
  }
  if (!_db) {
    // prepare:false required for transaction poolers (Supabase PgBouncer, Neon pooler)
    const client = postgres(process.env.DATABASE_URL!, { prepare: false });
    _db = drizzle(client, { schema });
  }
  return _db;
}
