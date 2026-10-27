// create-login logic: talks straight to the clinic's Neon Auth URL (never our site), signs in as the
// clinic admin, then uses Better Auth's admin plugin endpoints (better-auth/dist/plugins/admin/routes.mjs):
//   POST admin/create-user        { email, password, name, role }  -> { user: { id } }
//   GET  admin/list-users?filterField=email&filterOperator=eq&filterValue=<email> -> { users, total }
//   POST admin/set-user-password  { userId, newPassword }          -> { status: true }
// Prints only "created <email> id=<id>" / "password reset for <email>"; errors carry status + code only.
import { newPasswordProblem, parseClinicArgs, type Ask, type Print } from './cli';
import { cookieHeader, errorCode, setCookiePairs } from './http';
import type { ClinicLoginConfig } from './login-config';

export class AdminApiError extends Error {
  constructor(step: string, readonly status: number, readonly code?: string) {
    super(`${step} failed: status ${status}${code ? ` ${code}` : ''}`);
    this.name = 'AdminApiError';
  }
}

interface CreateLoginOptions {
  fetch: typeof globalThis.fetch;
  config: Pick<ClinicLoginConfig, 'authBaseUrl' | 'adminEmail' | 'siteUrl'>;
  email: string;
  reset: boolean;
  adminPassword: string;
  newPassword: string;
}

export async function runCreateLogin(o: CreateLoginOptions): Promise<string> {
  const base = o.config.authBaseUrl.replace(/\/+$/, '');
  let cookies = '';
  // Better Auth refuses POSTs without an Origin it trusts (MISSING_ORIGIN); the clinic's site URL is trusted.
  const call = async (step: string, path: string, body?: unknown) => {
    const headers: Record<string, string> = { origin: o.config.siteUrl };
    if (cookies) headers.cookie = cookies;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await o.fetch(`${base}/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    if (res.status !== 200) throw new AdminApiError(step, res.status, await errorCode(res));
    return res;
  };

  const signIn = await call('admin sign-in', 'sign-in/email', { email: o.config.adminEmail, password: o.adminPassword });
  const pairs = setCookiePairs(signIn);
  if (pairs.size === 0) throw new Error('admin sign-in returned no session cookie');
  cookies = cookieHeader(pairs);

  if (!o.reset) {
    const res = await call('create-user', 'admin/create-user', { email: o.email, password: o.newPassword, name: o.email, role: 'user' });
    const id = ((await res.json()) as { user?: { id?: string } }).user?.id;
    if (!id) throw new Error('create-user answered 200 without a user id');
    return `created ${o.email} id=${id}`;
  }

  // list-users defaults to a "contains" search, so ask for an exact match and re-check it here.
  const query = new URLSearchParams({ filterField: 'email', filterOperator: 'eq', filterValue: o.email, limit: '2' });
  const list = await call('list-users', `admin/list-users?${query}`);
  const users = ((await list.json()) as { users?: { id: string; email: string }[] }).users ?? [];
  const matches = users.filter((u) => u.email?.toLowerCase() === o.email);
  if (matches.length !== 1) throw new Error(`no login found for ${o.email}`);
  await call('set-user-password', 'admin/set-user-password', { userId: matches[0].id, newPassword: o.newPassword });
  return `password reset for ${o.email}`;
}

export interface CreateLoginMainDeps {
  argv: string[];
  readConfig: (slug: string) => ClinicLoginConfig;
  ask: Ask;
  fetch: typeof globalThis.fetch;
  out: Print;
  err: Print;
}

export async function createLoginMain(d: CreateLoginMainDeps): Promise<number> {
  try {
    const args = parseClinicArgs(d.argv);
    const config = d.readConfig(args.clinic);
    // Every password is asked before any network call, so a typo never leaves an admin session open.
    const adminPassword = await d.ask(`Admin password for ${config.adminEmail}: `);
    if (!adminPassword) throw new Error('no admin password entered');
    const newPassword = await d.ask(`New password for ${args.email}: `);
    const again = await d.ask('New password again: ');
    const problem = newPasswordProblem(newPassword, again);
    if (problem) throw new Error(problem);
    d.out(await runCreateLogin({ fetch: d.fetch, config, email: args.email, reset: args.reset, adminPassword, newPassword }));
    return 0;
  } catch (e) {
    d.err(`create-login: ${(e as Error).message}`);
    return 1;
  }
}
