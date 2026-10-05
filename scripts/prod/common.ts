// Shared bits for the production scripts. Production = Neon (database) + R2 (files) + Supabase (login
// only), served at PROD_SITE_URL by Vercel. Nothing here prints a connection string.
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import postgres from 'postgres';
import { pendingMigrations, maskDbUrl, type GitState, type JournalEntry } from '../../src/lib/prod-ops';

export const DEFAULT_PROD_SITE_URL = 'https://yoga-ten-tau.vercel.app';

/** Reads one key from .env without loading the rest (LOCAL_MOCK etc. must not leak into prod scripts). */
export function envValue(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  if (!existsSync('.env')) return undefined;
  const line = readFileSync('.env', 'utf8').split('\n').find((l) => l.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, '') || undefined;
}

export function prodDbUrl(): string {
  const url = envValue('PROD_DATABASE_URL');
  if (!url) fail('PROD_DATABASE_URL is not set in .env (Neon → Connect → Pooled connection).');
  return url;
}

export const prodSiteUrl = () => (envValue('PROD_SITE_URL') ?? DEFAULT_PROD_SITE_URL).replace(/\/+$/, '');

export function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

export const sh = (cmd: string) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export function gitState(): GitState {
  sh('git fetch --quiet origin main');
  const [behind, ahead] = sh('git rev-list --left-right --count origin/main...HEAD').split(/\s+/).map(Number);
  return { branch: sh('git rev-parse --abbrev-ref HEAD'), dirty: sh('git status --porcelain') !== '', behind, ahead };
}

export function journal(dir = '.'): JournalEntry[] {
  return JSON.parse(readFileSync(`${dir}/drizzle/meta/_journal.json`, 'utf8')).entries;
}

export interface ProdStatus { host: string; applied: number; pending: string[]; rows: Record<string, number | null> }

/** Read-only look at production: applied/pending migrations and a few row counts. */
export async function prodStatus(url = prodDbUrl()): Promise<ProdStatus> {
  const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 20, onnotice: () => {} });
  try {
    return await sql.begin('read only', async (tx) => {
      const [m] = await tx`select count(*)::int as n, max(created_at)::text as last from drizzle.__drizzle_migrations`;
      const tables = new Set((await tx`select table_name from information_schema.tables where table_schema = 'public'`).map((r) => r.table_name as string));
      const rows: Record<string, number | null> = {};
      for (const t of ['patients', 'visits', 'exercises', 'share_links']) {
        rows[t] = tables.has(t) ? (await tx.unsafe(`select count(*)::int as n from "${t}"`))[0].n : null;
      }
      return { host: maskDbUrl(url), applied: m.n, pending: pendingMigrations(journal(), m.last ? Number(m.last) : null), rows };
    });
  } finally {
    await sql.end();
  }
}

export function printStatus(s: ProdStatus) {
  console.log(`Production database: ${s.host}`);
  console.log(`Migrations applied:  ${s.applied}`);
  console.log(`Pending:             ${s.pending.length ? s.pending.join(', ') : 'none ✓'}`);
  console.log(`Rows:                ${Object.entries(s.rows).map(([t, n]) => `${t}=${n ?? 'n/a'}`).join(' · ')}`);
}

export async function confirm(phrase: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Type "${phrase}" to continue: `);
  rl.close();
  return answer.trim() === phrase;
}
