import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schema';

// Base type satisfied by both the postgres-js prod client and the PGlite test client.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
