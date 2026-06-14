import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import type { Db } from './types';

let _db: Db | undefined;

export function getDb(): Db {
  if (!_db) {
    // prepare:false required for transaction poolers (Supabase PgBouncer, Neon pooler)
    const client = postgres(process.env.DATABASE_URL!, { prepare: false });
    _db = drizzle(client, { schema });
  }
  return _db;
}
