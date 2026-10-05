// Pure helpers for the production scripts (scripts/prod/*): what's pending, whether this checkout may
// release, and whether the live site passed its smoke test. No I/O here so it can be unit-tested.

export interface JournalEntry { tag: string; when: number }

/** Migrations in the journal newer than the last one applied (drizzle compares creation times). */
export function pendingMigrations(journal: JournalEntry[], lastAppliedMillis: number | null): string[] {
  return journal.filter((e) => lastAppliedMillis === null || e.when > lastAppliedMillis).map((e) => e.tag);
}

export interface GitState { branch: string; dirty: boolean; behind: number; ahead: number }

/** Why this checkout must not touch production (empty = fine): only a clean, pushed, up-to-date main. */
export function releaseProblems(git: GitState): string[] {
  const problems: string[] = [];
  if (git.branch !== 'main') problems.push(`Not on main (on ${git.branch}) — production only gets merged code.`);
  if (git.dirty) problems.push('Uncommitted changes — commit or stash them first.');
  if (git.behind > 0) problems.push(`main is ${git.behind} commit(s) behind origin/main — run git pull.`);
  if (git.ahead > 0) problems.push(`main has ${git.ahead} unpushed commit(s) — push (via a PR) first.`);
  return problems;
}

/** Smoke-test paths whose HTTP status didn't match. */
export function smokeFailures(actual: Record<string, number | undefined>, expected: Record<string, number>): string[] {
  return Object.entries(expected)
    .filter(([path, status]) => actual[path] !== status)
    .map(([path, status]) => `${path}: expected ${status}, got ${actual[path] ?? 'no response'}`);
}

/** Database host for logs, without user, password or the instance-specific first label. */
export function maskDbUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^[^.]+/, '***');
  } catch {
    return '(invalid URL)';
  }
}

/**
 * The new deployment's URL from `vercel deploy --format=json` stdout. Non-interactive (agent) runs wrap
 * it as `{ deployment: { url } }`; plain JSON mode has `{ url }`. Null unless it's a *.vercel.app URL.
 */
export function deploymentUrlFromCli(stdout: string): string | null {
  try {
    const out = JSON.parse(stdout) as { url?: unknown; deployment?: { url?: unknown } };
    const url = out.deployment?.url ?? out.url;
    return typeof url === 'string' && /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(url) ? url : null;
  } catch {
    return null;
  }
}
