// login-smoke logic: seven checks against a running clinic site using the real login provider.
// Signs in through our allowlisted /api/auth route (a server action can't be called from a script).
// Prints check names and status codes only: never cookies, tokens, passwords or response bodies.
import { randomBytes } from 'node:crypto';
import { parseClinicArgs, type Ask, type Print } from './cli';
import { cookieHeader, setCookiePairs } from './http';
import type { ClinicLoginConfig } from './login-config';

export const SESSION_COOKIE = '__Secure-neon-auth.session_token';

export interface CheckResult { name: string; pass: boolean; status: number }

interface SmokeOptions {
  fetch: typeof globalThis.fetch;
  siteUrl: string;
  email: string;
  password: string;
  bypass?: string;
}

export async function runSmoke(o: SmokeOptions): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const request = (path: string, init: { method?: string; body?: unknown; cookies?: string } = {}) => {
    const headers: Record<string, string> = { origin: o.siteUrl };
    if (o.bypass) headers['x-vercel-protection-bypass'] = o.bypass;
    if (init.cookies) headers.cookie = init.cookies;
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    return o.fetch(`${o.siteUrl}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      redirect: 'manual',
    });
  };
  // Each check returns [pass, status]; a thrown error (network) is a fail with status 0, message dropped.
  const check = async (name: string, fn: () => Promise<[boolean, number]>) => {
    try {
      const [pass, status] = await fn();
      results.push({ name, pass, status });
    } catch {
      results.push({ name, pass: false, status: 0 });
    }
  };
  const signIn = (password: string) => request('/api/auth/sign-in/email', { method: 'POST', body: { email: o.email, password } });

  let session: string | undefined;
  await check('sign-in', async () => {
    const res = await signIn(o.password);
    const cookies = setCookiePairs(res);
    if (res.status !== 200 || !cookies.has(SESSION_COOKIE)) return [false, res.status];
    session = cookieHeader(cookies);
    const dash = await request('/dashboard', { cookies: session });
    return [dash.status === 200, dash.status];
  });

  await check('wrong-password-refused', async () => {
    const res = await signIn(`${o.password}-wrong-${randomBytes(4).toString('hex')}`);
    const refused = res.status >= 400 && res.status < 500 && !setCookiePairs(res).has(SESSION_COOKIE);
    return [refused, res.status];
  });

  await check('share-link-404', async () => {
    const res = await request(`/s/${randomBytes(16).toString('hex')}`);
    return [res.status === 404, res.status];
  });

  await check('search-api-401', async () => {
    const res = await request('/api/patients/search?q=a');
    return [res.status === 401, res.status];
  });

  // Body can't create a user even if the allowlist ever regressed while Neon sign-up was on.
  await check('sign-up-404', async () => {
    const res = await request('/api/auth/sign-up/email', { method: 'POST', body: {} });
    return [res.status === 404, res.status];
  });

  await check('sign-out', async () => {
    if (!session) return [false, 0];
    const res = await request('/api/auth/sign-out', { method: 'POST', body: {}, cookies: session });
    return [res.status === 200, res.status];
  });

  await check('replayed-cookie-refused', async () => {
    if (!session) return [false, 0];
    const res = await request('/dashboard', { cookies: session });
    const location = res.headers.get('location');
    const toLogin = location !== null && new URL(location, o.siteUrl).pathname === '/login';
    return [res.status === 307 && toLogin, res.status];
  });

  return results;
}

export function formatResult(r: CheckResult): string {
  if (!r.pass) return `FAIL ${r.name} (status ${r.status})`;
  // Any 4xx passes the wrong-password check; show which one it was.
  return r.name === 'wrong-password-refused' ? `PASS ${r.name} (status ${r.status})` : `PASS ${r.name}`;
}

export const smokeExitCode = (results: CheckResult[]) => (results.every((r) => r.pass) ? 0 : 1);

export interface SmokeMainDeps {
  argv: string[];
  readConfig: (slug: string) => ClinicLoginConfig;
  ask: Ask;
  fetch: typeof globalThis.fetch;
  out: Print;
  err: Print;
}

export async function loginSmokeMain(d: SmokeMainDeps): Promise<number> {
  try {
    const args = parseClinicArgs(d.argv);
    const config = d.readConfig(args.clinic);
    const siteUrl = args.site ?? config.siteUrl;
    const password = await d.ask(`Password for ${args.email}: `);
    if (!password) throw new Error('no password entered');
    const results = await runSmoke({ fetch: d.fetch, siteUrl, email: args.email, password, bypass: config.vercelProtectionBypass });
    results.forEach((r) => d.out(formatResult(r)));
    return smokeExitCode(results);
  } catch (e) {
    d.err(`login-smoke: ${(e as Error).message}`);
    return 1;
  }
}
