// npm run deploy:prod — deploys main to production and rolls back if the live site fails its smoke test.
// Vercel isn't connected to git, so this is the only way main reaches production.
//  1. Only from a clean, pushed, up-to-date main; refuses while production has pending migrations.
//  2. Builds from a temporary worktree of HEAD — no .env, so local values can't leak into the build.
//  3. Promotes the new deployment (needed after any earlier rollback), smoke-tests the live domain,
//     and rolls back to the previous deployment on any failure.
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { alreadyLive, deploymentUrlFromCli, releaseProblems, smokeFailures } from '../../src/lib/prod-ops';
import { envValue, fail, gitState, printStatus, prodSiteUrl, prodStatus, sh } from './common';

const DEPLOY_TIMEOUT_MS = 15 * 60_000;
/** promote / rollback: give Vercel time on a bad day — that's exactly when a rollback matters. */
const SWITCH_TIMEOUT_MS = 5 * 60_000;

/** What the CLI said: execSync's message is only "Command failed: …"; the cause is in stderr. */
const cliError = (e: unknown) => {
  const err = e as Error & { stderr?: string };
  return (err.stderr?.trim() || err.message).slice(-1500);
};

/** Vercel CLI; returns stdout only (progress and logs go to stderr). */
const vercel = (args: string, cwd?: string, timeoutMs?: number) =>
  sh(`${cwd ? `cd "${cwd}" && ` : ''}vercel ${args}`, timeoutMs);

/** The deployment URL currently serving the live domain (for rollback). */
function currentDeployment(site: string): string {
  // `vercel inspect` prints its details on stderr, so capture both here.
  const url = sh(`vercel inspect ${site} 2>&1`).match(/url\s+(https:\/\/\S+)/)?.[1];
  if (!url) fail(`Could not find the current deployment of ${site} (is the Vercel CLI logged in?).`);
  return url;
}

async function status(url: string, headers?: Record<string, string>): Promise<number | undefined> {
  try {
    return (await fetch(url, { redirect: 'manual', headers, signal: AbortSignal.timeout(30_000) })).status;
  } catch {
    return undefined;
  }
}

async function smoke(site: string): Promise<string[]> {
  // /api/ping answers 401 without the cron secret (still proves the build is up); with it, 200 = DB + login OK.
  const cronSecret = envValue('CRON_SECRET');
  const expected: Record<string, number | number[]> = {
    '/login': 200,
    '/api/ping': cronSecret ? 200 : [200, 401],
    [`/s/${randomBytes(8).toString('hex')}`]: 404,
  };
  const auth = (p: string) => (p === '/api/ping' && cronSecret ? { authorization: `Bearer ${cronSecret}` } : undefined);
  let failures: string[] = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const actual = Object.fromEntries(await Promise.all(Object.keys(expected).map(async (p) => [p, await status(site + p, auth(p))])));
    failures = smokeFailures(actual, expected);
    if (!failures.length) return [];
    await new Promise((r) => setTimeout(r, 5_000)); // aliases can take a few seconds to switch
  }
  return failures;
}

async function main() {
  const problems = releaseProblems(gitState());
  if (problems.length) fail(`Refusing to deploy:\n  - ${problems.join('\n  - ')}`);

  const db = await prodStatus();
  printStatus(db);
  if (db.pending.length) fail('Production has pending migrations — run `npm run db:migrate:prod` first.');

  const site = prodSiteUrl();
  const previous = currentDeployment(site);
  console.log(`\nLive now: ${previous}`);

  // Inside here, errors are thrown (not fail()) so `finally` removes the worktree before exiting.
  const dir = mkdtempSync(join(tmpdir(), 'yoga-deploy-'));
  try {
    sh('git worktree prune'); // forget worktrees left behind by an interrupted earlier run
    sh(`git worktree add --detach "${dir}" HEAD`);
    mkdirSync(join(dir, '.vercel'));
    copyFileSync('.vercel/project.json', join(dir, '.vercel', 'project.json'));

    console.log(`Building ${sh('git rev-parse --short HEAD')} on Vercel…`);
    // JSON on stdout (logs go to stderr), so the URL is read from a structure, not scraped from text.
    let stdout = '';
    try {
      stdout = vercel('deploy --prod --yes --format=json', dir, DEPLOY_TIMEOUT_MS);
    } catch (e) {
      // Failed builds never go live, but a timed-out one may still finish and take the domain.
      throw new Error(`vercel deploy failed or timed out:\n${cliError(e)}\n` +
        `  If a new deployment still went live and misbehaves: vercel rollback ${previous} --yes`);
    }
    const deployment = deploymentUrlFromCli(stdout);
    if (!deployment || deployment === site) {
      // A --prod build may already be serving the domain, so put the previous one back.
      console.error(`\n✖ Deploy did not report a deployment URL. Rolling back to ${previous}…`);
      vercel(`rollback ${previous} --yes`, undefined, SWITCH_TIMEOUT_MS);
      throw new Error('Rolled back. Check the Vercel dashboard for the deployment.');
    }
    console.log(`Built:    ${deployment}`);
    // Needed after an earlier rollback; otherwise the --prod build is usually live already (Vercel answers 409).
    try {
      vercel(`promote ${deployment} --yes`, undefined, SWITCH_TIMEOUT_MS);
    } catch (e) {
      // Either way the build may be serving the domain, so let the smoke test decide (it rolls back).
      if (!alreadyLive(cliError(e))) console.warn(`⚠ promote failed, checking the live site anyway:\n${cliError(e)}`);
    }

    const failures = await smoke(site);
    if (failures.length) {
      console.error(`\n✖ Smoke test failed:\n  - ${failures.join('\n  - ')}\nRolling back to ${previous}…`);
      vercel(`rollback ${previous} --yes`, undefined, SWITCH_TIMEOUT_MS);
      throw new Error('Rolled back. Check `vercel logs` for the failed deployment.');
    }
    console.log(`\n✓ Live: ${site} (${deployment}) — /login, /api/ping and an unknown share link all OK.`);
  } finally {
    try { sh(`git worktree remove --force "${dir}"`); } catch { rmSync(dir, { recursive: true, force: true }); }
  }
}

main().catch((e) => fail(e.message));
