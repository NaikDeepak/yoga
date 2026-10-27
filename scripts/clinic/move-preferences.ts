// npm run move-preferences -- --from <old user id> --to <new user id>
// Moves one login's preferences row (language, WhatsApp number) in PRODUCTION (PROD_DATABASE_URL in .env)
// to the user's new id. Refuses if --from has no row or --to already has one. Prints the row count only.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../src/db/schema';
import type { Db } from '../../src/db/types';
import { moveUserPreferences } from '../../src/data/preferences';
import { fail, prodDbUrl } from '../prod/common';
import { parseMoveArgs } from './cli';

async function main() {
  let args: { from: string; to: string };
  try {
    args = parseMoveArgs(process.argv.slice(2));
  } catch (e) {
    fail((e as Error).message);
  }
  const sql = postgres(prodDbUrl(), { prepare: false, max: 1, connect_timeout: 20, onnotice: () => {} });
  try {
    const moved = await moveUserPreferences(drizzle(sql, { schema }) as unknown as Db, args.from, args.to);
    console.log(`moved ${moved} row${moved === 1 ? '' : 's'}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => fail(`move-preferences: ${e.code ?? ''} ${e.message}`.replace(/\s+/g, ' ')));
