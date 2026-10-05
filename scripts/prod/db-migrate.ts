// npm run db:migrate:prod — applies pending migrations to production (Neon), only from a clean,
// up-to-date main, after showing what will run and a typed confirmation.
import { execSync } from 'node:child_process';
import { releaseProblems } from '../../src/lib/prod-ops';
import { confirm, fail, gitState, printStatus, prodDbUrl, prodStatus } from './common';

async function main() {
  const problems = releaseProblems(gitState());
  if (problems.length) fail(`Refusing to migrate production:\n  - ${problems.join('\n  - ')}`);

  const url = prodDbUrl();
  const before = await prodStatus(url);
  printStatus(before);
  if (!before.pending.length) return console.log('\nNothing to migrate.');

  if (!(await confirm('migrate prod'))) fail('Cancelled — nothing changed.');
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: url };
  delete env.LOCAL_MOCK;
  execSync('npx drizzle-kit migrate', { stdio: ['ignore', 'ignore', 'inherit'], env });

  const after = await prodStatus(url);
  console.log('');
  printStatus(after);
  if (after.pending.length) fail('Some migrations are still pending — check the output above.');
  console.log('\n✓ Production database is up to date.');
}

main().catch((e) => fail(e.message));
