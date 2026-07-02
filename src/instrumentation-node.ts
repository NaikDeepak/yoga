// Node-runtime startup work. Only ever imported from src/instrumentation.ts
// behind a NEXT_RUNTIME === 'nodejs' check, so the edge bundle never sees the
// PGlite / node:fs imports below.
import { isLocalMock } from '@/lib/local-mock';
import { getLocalDb, LOCAL_DB_DIR } from '@/db/local-client';

export async function initLocalMock() {
  if (!isLocalMock()) return;
  await getLocalDb().ready;
  // No credentials in logs (they end up in aggregators); see docs/setup.md.
  console.log(`[local-mock] PGlite DB ready at ${LOCAL_DB_DIR}/ — sign-in details in docs/setup.md`);
}
