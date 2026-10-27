import { describe, it, expect } from 'vitest';
import { createLoginMain, runCreateLogin, AdminApiError } from '../../scripts/clinic/neon-admin';

const BASE = 'https://ep-x.neonauth.example/neondb/auth';
const SITE = 'https://clinic.example';
const config = { authBaseUrl: BASE, adminEmail: 'admin@example.com', siteUrl: SITE };
const ADMIN_PW = 'admin-secret-pw';
const NEW_PW = 'new-staff-pw-99';

type Call = { method: string; url: URL; headers: Headers; body: Record<string, unknown> | null };

function json(status: number, body: unknown, setCookies: string[] = []) {
  const headers = new Headers([['content-type', 'application/json'], ...setCookies.map((c) => ['set-cookie', c] as [string, string])]);
  return new Response(JSON.stringify(body), { status, headers });
}

function fakeNeon(override: Partial<Record<string, (c: Call) => Response>> = {}) {
  const calls: Call[] = [];
  const routes: Record<string, (c: Call) => Response> = {
    'POST /neondb/auth/sign-in/email': () =>
      json(200, { user: { id: 'admin-1' } }, ['__Secure-x.session_token=adm-tok; Path=/; HttpOnly', 'x.session_data=adm-cache; Path=/']),
    'POST /neondb/auth/admin/create-user': () => json(200, { user: { id: 'user-42', email: 'staff@example.com' } }),
    'GET /neondb/auth/admin/list-users': () => json(200, { users: [{ id: 'user-42', email: 'staff@example.com' }], total: 1 }),
    'POST /neondb/auth/admin/set-user-password': () => json(200, { status: true }),
    'POST /neondb/auth/admin/revoke-user-sessions': () => json(200, { success: true }),
    'POST /neondb/auth/sign-out': () => json(200, { success: true }),
    ...override,
  };
  const fetch = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const call: Call = { method: init.method ?? 'GET', url, headers: new Headers(init.headers), body: init.body ? JSON.parse(String(init.body)) : null };
    calls.push(call);
    const route = routes[`${call.method} ${url.pathname}`];
    return route ? route(call) : json(404, { code: 'NOT_FOUND' });
  };
  return { fetch: fetch as typeof globalThis.fetch, calls };
}

describe('runCreateLogin', () => {
  it('signs in as admin directly at the auth URL with Origin, then creates the user', async () => {
    const neon = fakeNeon();
    const line = await runCreateLogin({ fetch: neon.fetch, config, email: 'staff@example.com', reset: false, adminPassword: ADMIN_PW, newPassword: NEW_PW });
    expect(line).toBe('created staff@example.com id=user-42');
    const [signIn, create] = neon.calls;
    expect(signIn.url.href).toBe(`${BASE}/sign-in/email`);
    expect(signIn.body).toEqual({ email: 'admin@example.com', password: ADMIN_PW });
    expect(create.url.href).toBe(`${BASE}/admin/create-user`);
    expect(create.body).toEqual({ email: 'staff@example.com', password: NEW_PW, name: 'staff@example.com', role: 'user' });
    expect(create.headers.get('cookie')).toBe('__Secure-x.session_token=adm-tok; x.session_data=adm-cache');
    for (const c of neon.calls) expect(c.headers.get('origin')).toBe(SITE);
  });

  it('with reset, looks the user up by exact email and sets the password', async () => {
    const neon = fakeNeon();
    const line = await runCreateLogin({ fetch: neon.fetch, config, email: 'staff@example.com', reset: true, adminPassword: ADMIN_PW, newPassword: NEW_PW });
    expect(line).toBe('password reset for staff@example.com; signed out everywhere');
    const list = neon.calls[1];
    expect(list.url.searchParams.get('filterField')).toBe('email');
    expect(list.url.searchParams.get('filterOperator')).toBe('eq');
    expect(list.url.searchParams.get('filterValue')).toBe('staff@example.com');
    expect(neon.calls[2].body).toEqual({ userId: 'user-42', newPassword: NEW_PW });
    expect(neon.calls[3].url.href).toBe(`${BASE}/admin/revoke-user-sessions`);
    expect(neon.calls[3].method).toBe('POST');
    expect(neon.calls[3].body).toEqual({ userId: 'user-42' });
  });

  it('reset fails loudly when the sessions could not be revoked, never claiming success', async () => {
    const neon = fakeNeon({ 'POST /neondb/auth/admin/revoke-user-sessions': () => json(403, { code: 'FORBIDDEN' }) });
    await expect(runCreateLogin({ fetch: neon.fetch, config, email: 'staff@example.com', reset: true, adminPassword: ADMIN_PW, newPassword: NEW_PW }))
      .rejects.toThrow('password changed but sessions not revoked (403 FORBIDDEN)');
  });

  it('signs the admin session out after success and after failure', async () => {
    const ok = fakeNeon();
    await runCreateLogin({ fetch: ok.fetch, config, email: 'staff@example.com', reset: false, adminPassword: ADMIN_PW, newPassword: NEW_PW });
    const out = ok.calls.at(-1)!;
    expect(out.url.href).toBe(`${BASE}/sign-out`);
    expect(out.method).toBe('POST');
    expect(out.headers.get('cookie')).toBe('__Secure-x.session_token=adm-tok; x.session_data=adm-cache');
    const bad = fakeNeon({ 'POST /neondb/auth/admin/create-user': () => json(403, { code: 'X' }), 'POST /neondb/auth/sign-out': () => json(500, {}) });
    await expect(runCreateLogin({ fetch: bad.fetch, config, email: 'staff@example.com', reset: false, adminPassword: ADMIN_PW, newPassword: NEW_PW }))
      .rejects.toThrow('create-user failed: status 403 X');
    expect(bad.calls.at(-1)!.url.pathname).toBe('/neondb/auth/sign-out');
  });

  it('reset refuses when no user has exactly that email', async () => {
    const neon = fakeNeon({ 'GET /neondb/auth/admin/list-users': () => json(200, { users: [{ id: 'u9', email: 'xstaff@example.com' }], total: 1 }) });
    await expect(runCreateLogin({ fetch: neon.fetch, config, email: 'staff@example.com', reset: true, adminPassword: ADMIN_PW, newPassword: NEW_PW }))
      .rejects.toThrow(/no login/);
    expect(neon.calls.some((c) => c.url.pathname.endsWith('set-user-password'))).toBe(false);
  });

  it('a 403 YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS becomes a status + code error', async () => {
    const neon = fakeNeon({ 'POST /neondb/auth/admin/create-user': () => json(403, { code: 'YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS', message: 'nope' }) });
    const err = await runCreateLogin({ fetch: neon.fetch, config, email: 'staff@example.com', reset: false, adminPassword: ADMIN_PW, newPassword: NEW_PW }).catch((e) => e);
    expect(err).toBeInstanceOf(AdminApiError);
    expect(err.message).toBe('create-user failed: status 403 YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS');
  });

  it('a failed admin sign-in stops before any admin call', async () => {
    const neon = fakeNeon({ 'POST /neondb/auth/sign-in/email': () => json(401, { code: 'INVALID_EMAIL_OR_PASSWORD' }) });
    await expect(runCreateLogin({ fetch: neon.fetch, config, email: 'staff@example.com', reset: false, adminPassword: ADMIN_PW, newPassword: NEW_PW }))
      .rejects.toThrow('admin sign-in failed: status 401 INVALID_EMAIL_OR_PASSWORD');
    expect(neon.calls).toHaveLength(1);
  });

  it('a sign-in with no cookies is an error, and a non-JSON error body prints the status alone', async () => {
    const noCookie = fakeNeon({ 'POST /neondb/auth/sign-in/email': () => json(200, {}) });
    await expect(runCreateLogin({ fetch: noCookie.fetch, config, email: 'staff@example.com', reset: false, adminPassword: ADMIN_PW, newPassword: NEW_PW }))
      .rejects.toThrow(/no session cookie/);
    const html = fakeNeon({ 'POST /neondb/auth/admin/create-user': () => new Response('<html>oops</html>', { status: 502 }) });
    await expect(runCreateLogin({ fetch: html.fetch, config, email: 'staff@example.com', reset: false, adminPassword: ADMIN_PW, newPassword: NEW_PW }))
      .rejects.toThrow(/^create-user failed: status 502$/);
  });
});

describe('runCreateLogin error paths', () => {
  const opts = (neon: ReturnType<typeof fakeNeon>, reset: boolean) =>
    ({ fetch: neon.fetch, config, email: 'staff@example.com', reset, adminPassword: ADMIN_PW, newPassword: NEW_PW });

  it('a 200 with an unreadable body gets a fixed message, no body snippet', async () => {
    const neon = fakeNeon({ 'POST /neondb/auth/admin/create-user': () => new Response('<html>leaky-snippet</html>', { status: 200 }) });
    const err = await runCreateLogin(opts(neon, false)).catch((e) => e);
    expect(err.message).toBe('create-user answered 200 with an unreadable body');
    const list = fakeNeon({ 'GET /neondb/auth/admin/list-users': () => new Response('not json', { status: 200 }) });
    await expect(runCreateLogin(opts(list, true))).rejects.toThrow('list-users answered 200 with an unreadable body');
  });

  it('reset refuses with a distinct message when more than one login matches', async () => {
    const neon = fakeNeon({ 'GET /neondb/auth/admin/list-users': () => json(200, { users: [{ id: 'a', email: 'staff@example.com' }, { id: 'b', email: 'STAFF@example.com' }], total: 2 }) });
    await expect(runCreateLogin(opts(neon, true))).rejects.toThrow('more than one login matches staff@example.com');
    expect(neon.calls.some((c) => c.url.pathname.endsWith('set-user-password'))).toBe(false);
  });
});

describe('createLoginMain', () => {
  function harness(neon = fakeNeon(), answers = [ADMIN_PW, NEW_PW, NEW_PW]) {
    const out: string[] = [];
    const err: string[] = [];
    const asked: string[] = [];
    const deps = {
      argv: ['--clinic', 'sunrise', '--email', 'Staff@Example.com'],
      readConfig: () => config,
      ask: async (q: string) => { asked.push(q); return answers.shift() ?? ''; },
      fetch: neon.fetch,
      out: (s: string) => out.push(s),
      err: (s: string) => err.push(s),
    };
    return { deps, out, err, asked, neon };
  }

  it('asks all three passwords, prints only the created line, and no password anywhere', async () => {
    const h = harness();
    expect(await createLoginMain(h.deps)).toBe(0);
    expect(h.asked).toHaveLength(3);
    expect(h.out).toEqual(['created staff@example.com id=user-42']);
    const printed = [...h.out, ...h.err, ...h.asked].join('\n');
    expect(printed).not.toContain(ADMIN_PW);
    expect(printed).not.toContain(NEW_PW);
    expect(h.neon.calls[1].body?.password).toBe(NEW_PW);
  });

  it('prints the 403 as status + code and exits 1 without passwords', async () => {
    const h = harness(fakeNeon({ 'POST /neondb/auth/admin/create-user': () => json(403, { code: 'YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS' }) }));
    expect(await createLoginMain(h.deps)).toBe(1);
    expect(h.out).toEqual([]);
    expect(h.err.join('\n')).toContain('status 403 YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS');
    expect([...h.out, ...h.err].join('\n')).not.toMatch(new RegExp(`${ADMIN_PW}|${NEW_PW}`));
  });

  it('refuses mismatched new passwords before any network call', async () => {
    const h = harness(fakeNeon(), [ADMIN_PW, NEW_PW, 'something-else']);
    expect(await createLoginMain(h.deps)).toBe(1);
    expect(h.neon.calls).toHaveLength(0);
    expect(h.err.join('\n')).toMatch(/match/);
  });

  it('reports a config refusal and exits 1', async () => {
    const h = harness();
    h.deps.readConfig = () => { throw new Error('~/.config/clinics/sunrise.env is missing ADMIN_EMAIL'); };
    expect(await createLoginMain(h.deps)).toBe(1);
    expect(h.err.join('\n')).toContain('missing ADMIN_EMAIL');
    expect(h.asked).toHaveLength(0);
  });
});
