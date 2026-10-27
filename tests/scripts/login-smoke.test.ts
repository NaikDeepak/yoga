import { describe, it, expect } from 'vitest';
import { runSmoke, formatResult, smokeExitCode, loginSmokeMain, type CheckResult } from '../../scripts/clinic/smoke';

const SITE = 'https://clinic.example';
const SESSION = '__Secure-neon-auth.session_token';
const PASSWORD = 'right-password-123';

type Call = { method: string; path: string; headers: Headers; body?: string };

function res(status: number, extra: [string, string][] = [], body: string | null = null) {
  return new Response(body, { status, headers: new Headers(extra) });
}

/** A site that behaves correctly; `override` swaps one route's answer. */
function fakeSite(override: Partial<Record<string, (c: Call) => Response>> = {}) {
  const calls: Call[] = [];
  let signedOut = false;
  const routes: Record<string, (c: Call) => Response> = {
    'POST /api/auth/sign-in/email': (c) => {
      const { password } = JSON.parse(c.body ?? '{}');
      return password === PASSWORD
        ? res(200, [['set-cookie', `${SESSION}=tok123; Path=/; Secure; HttpOnly`], ['set-cookie', '__Secure-neon-auth.local.session_data=cache456; Path=/']])
        : res(401, [], '{"code":"INVALID_EMAIL_OR_PASSWORD"}');
    },
    'GET /dashboard': (c) => {
      const ok = (c.headers.get('cookie') ?? '').includes(`${SESSION}=tok123`) && !signedOut;
      return ok ? res(200) : res(307, [['location', '/login']]);
    },
    'GET /s/': () => res(404),
    'GET /api/patients/search': (c) => (c.headers.get('cookie') ? res(200) : res(401)),
    'POST /api/auth/sign-up/email': () => res(404),
    'POST /api/auth/sign-out': (c) => {
      if ((c.headers.get('cookie') ?? '').includes(SESSION)) signedOut = true;
      return res(200, [['set-cookie', `${SESSION}=; Max-Age=0; Path=/`]]);
    },
    ...override,
  };
  const fetch = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const call: Call = { method: init.method ?? 'GET', path: url.pathname, headers: new Headers(init.headers), body: init.body as string | undefined };
    calls.push(call);
    expect(init.redirect).toBe('manual');
    const key = `${call.method} ${url.pathname.startsWith('/s/') ? '/s/' : url.pathname}`;
    const route = routes[key];
    return route ? route(call) : res(404);
  };
  return { fetch: fetch as typeof globalThis.fetch, calls };
}

const run = (site: ReturnType<typeof fakeSite>, bypass?: string) =>
  runSmoke({ fetch: site.fetch, siteUrl: SITE, email: 'test@example.com', password: PASSWORD, bypass });

describe('runSmoke', () => {
  it('passes all seven checks against a correct site, in order', async () => {
    const results = await run(fakeSite());
    expect(results.map((r) => r.name)).toEqual([
      'sign-in', 'wrong-password-refused', 'share-link-404', 'search-api-401', 'sign-up-404', 'sign-out', 'replayed-cookie-refused',
    ]);
    expect(results.every((r) => r.pass)).toBe(true);
    expect(smokeExitCode(results)).toBe(0);
  });

  it('sends Origin on every request and the bypass header when configured', async () => {
    const site = fakeSite();
    await run(site, 'bypass-xyz');
    expect(site.calls.length).toBeGreaterThanOrEqual(8);
    for (const c of site.calls) {
      expect(c.headers.get('origin')).toBe(SITE);
      expect(c.headers.get('x-vercel-protection-bypass')).toBe('bypass-xyz');
    }
  });

  it('sends no bypass header when none is configured', async () => {
    const site = fakeSite();
    await run(site);
    expect(site.calls.some((c) => c.headers.has('x-vercel-protection-bypass'))).toBe(false);
  });

  it('records the wrong-password status', async () => {
    const results = await run(fakeSite());
    expect(results[1]).toMatchObject({ name: 'wrong-password-refused', pass: true, status: 401 });
  });

  it('fails share-link-404 when /s/ redirects to login (307)', async () => {
    const results = await run(fakeSite({ 'GET /s/': () => res(307, [['location', '/login']]) }));
    expect(results[2]).toMatchObject({ pass: false, status: 307 });
    expect(smokeExitCode(results)).toBe(1);
  });

  it('fails sign-up-404 when sign-up answers anything but 404, and never sends a creatable body', async () => {
    const site = fakeSite({ 'POST /api/auth/sign-up/email': () => res(400) });
    const results = await run(site);
    expect(results[4]).toMatchObject({ name: 'sign-up-404', pass: false, status: 400 });
    const signUp = site.calls.find((c) => c.path === '/api/auth/sign-up/email')!;
    expect(signUp.body).not.toContain('password');
  });

  it('fails wrong-password-refused when a bad password gets a session cookie', async () => {
    const results = await run(fakeSite({ 'POST /api/auth/sign-in/email': () => res(200, [['set-cookie', `${SESSION}=tok123; Path=/`]]) }));
    expect(results[1]).toMatchObject({ pass: false, status: 200 });
  });

  it('fails replayed-cookie-refused when the old cookie still opens /dashboard', async () => {
    const results = await run(fakeSite({ 'POST /api/auth/sign-out': () => res(200) }));
    expect(results[6]).toMatchObject({ name: 'replayed-cookie-refused', pass: false, status: 200 });
  });

  it('fails sign-in, sign-out and replay with status 0 when no session cookie comes back', async () => {
    const results = await run(fakeSite({ 'POST /api/auth/sign-in/email': () => res(200) }));
    expect(results[0]).toMatchObject({ name: 'sign-in', pass: false, status: 200 });
    expect(results[5]).toMatchObject({ pass: false, status: 0 });
    expect(results[6]).toMatchObject({ pass: false, status: 0 });
  });

  it('turns a network error into a status-0 fail instead of throwing', async () => {
    const site = fakeSite({ 'GET /api/patients/search': () => { throw new Error('ECONNRESET secret-detail'); } });
    const results = await run(site);
    expect(results[3]).toMatchObject({ pass: false, status: 0 });
    expect(results.map(formatResult).join('\n')).not.toContain('secret-detail');
  });
});

describe('formatResult', () => {
  it('prints PASS <name>', () => {
    expect(formatResult({ name: 'sign-in', pass: true, status: 200 })).toBe('PASS sign-in');
  });
  it('prints the status on the wrong-password pass line (which 4xx it was)', () => {
    expect(formatResult({ name: 'wrong-password-refused', pass: true, status: 401 })).toBe('PASS wrong-password-refused (status 401)');
  });
  it('a fail line names the check and the status code only', () => {
    expect(formatResult({ name: 'share-link-404', pass: false, status: 307 })).toBe('FAIL share-link-404 (status 307)');
  });
  it('never prints cookies or passwords from a whole run', async () => {
    const out = (await run(fakeSite())).map(formatResult).join('\n');
    expect(out).not.toMatch(/tok123|cache456|right-password/);
  });
});

describe('smokeExitCode', () => {
  it('is non-zero when any check fails', () => {
    const results: CheckResult[] = [{ name: 'a', pass: true, status: 200 }, { name: 'b', pass: false, status: 500 }];
    expect(smokeExitCode(results)).toBe(1);
  });
});

describe('loginSmokeMain', () => {
  const config = { authBaseUrl: 'https://auth.example', adminEmail: 'admin@example.com', siteUrl: SITE, vercelProtectionBypass: undefined };
  function harness(site = fakeSite(), argv = ['--clinic', 'sunrise', '--email', 'test@example.com']) {
    const out: string[] = [];
    const err: string[] = [];
    return {
      out, err, site,
      deps: { argv, readConfig: () => config, ask: async () => PASSWORD, fetch: site.fetch, out: (s: string) => out.push(s), err: (s: string) => err.push(s) },
    };
  }

  it('prints one line per check and exits 0 when all pass', async () => {
    const h = harness();
    expect(await loginSmokeMain(h.deps)).toBe(0);
    expect(h.out).toHaveLength(7);
    expect(h.out.join('\n')).not.toContain(PASSWORD);
  });

  it('exits 1 when a check fails', async () => {
    const h = harness(fakeSite({ 'GET /api/patients/search': () => res(200) }));
    expect(await loginSmokeMain(h.deps)).toBe(1);
    expect(h.out).toContain('FAIL search-api-401 (status 200)');
  });

  it('--site overrides SITE_URL (Origin follows it)', async () => {
    const h = harness(fakeSite(), ['--clinic', 'sunrise', '--email', 'test@example.com', '--site', 'https://preview-abc.vercel.app/']);
    await loginSmokeMain(h.deps);
    expect(h.site.calls[0].headers.get('origin')).toBe('https://preview-abc.vercel.app');
  });

  it('reports bad arguments and exits 1', async () => {
    const h = harness(fakeSite(), ['--clinic', 'sunrise']);
    expect(await loginSmokeMain(h.deps)).toBe(1);
    expect(h.err.join('\n')).toMatch(/--email/);
    expect(h.site.calls).toHaveLength(0);
  });
});
