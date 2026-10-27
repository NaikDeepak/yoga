import { describe, it, expect } from 'vitest';
import { extractResetToken, resetPasswordMain } from '../../scripts/clinic/password-reset';

const BASE = 'https://ep-x.neonauth.example/neondb/auth';
const SITE = 'https://clinic.example';
const config = { authBaseUrl: BASE, adminEmail: 'admin@example.com', siteUrl: SITE };
const TOKEN = 'AbC123_-xyz';
const NEW_PW = 'brand-new-pw-1';

describe('extractResetToken', () => {
  it('reads the emailed link form {base}/reset-password/<token>?callbackURL=…', () => {
    expect(extractResetToken(`${BASE}/reset-password/${TOKEN}?callbackURL=${encodeURIComponent(`${SITE}/login`)}`)).toBe(TOKEN);
  });
  it('reads the clicked-through form …?token=<token>', () => {
    expect(extractResetToken(`  ${SITE}/login?token=${TOKEN}\n`)).toBe(TOKEN);
  });
  it('rejects junk, other paths and bad token characters', () => {
    for (const bad of ['', 'not a url', `${SITE}/login`, `${BASE}/reset-password/`, `${SITE}/login?token=a%20b`, `${BASE}/reset-password/a.b`, `${SITE}/login?token=${'a'.repeat(257)}`, `${BASE}/reset-password/%E0%A4%A`]) {
      expect(() => extractResetToken(bad)).toThrow(/link/);
    }
  });
  it('never repeats the pasted text in its error', () => {
    expect(() => extractResetToken('https://x.example/secret-ish')).toThrow(/^(?!.*secret-ish)/);
  });
});

type Call = { method: string; url: URL; headers: Headers; body: Record<string, unknown> | null };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function harness(opts: { answers?: string[]; routes?: Partial<Record<string, () => Response>> } = {}) {
  const calls: Call[] = [];
  const out: string[] = [];
  const err: string[] = [];
  const asked: string[] = [];
  const answers = opts.answers ?? [`${BASE}/reset-password/${TOKEN}?callbackURL=x`, NEW_PW, NEW_PW];
  const routes: Record<string, () => Response> = {
    'POST /neondb/auth/request-password-reset': () => json(200, { status: true }),
    'POST /neondb/auth/reset-password': () => json(200, { status: true }),
    ...opts.routes,
  };
  const fetch = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    calls.push({ method: init.method ?? 'GET', url, headers: new Headers(init.headers), body: init.body ? JSON.parse(String(init.body)) : null });
    return (routes[`${init.method} ${url.pathname}`] ?? (() => json(404, {})))();
  };
  const deps = {
    argv: ['--clinic', 'sunrise', '--email', 'Admin@Example.com'],
    readConfig: () => config,
    ask: async (q: string) => { asked.push(q); return answers.shift() ?? ''; },
    fetch: fetch as typeof globalThis.fetch,
    out: (s: string) => out.push(s),
    err: (s: string) => err.push(s),
  };
  return { deps, calls, out, err, asked };
}

describe('resetPasswordMain', () => {
  it('requests the email, takes the pasted link, sets the password; Origin on every call', async () => {
    const h = harness();
    expect(await resetPasswordMain(h.deps)).toBe(0);
    expect(h.calls.map((c) => `${c.method} ${c.url.href}`)).toEqual([
      `POST ${BASE}/request-password-reset`,
      `POST ${BASE}/reset-password`,
    ]);
    expect(h.calls[0].body).toEqual({ email: 'admin@example.com', redirectTo: `${SITE}/login` });
    expect(h.calls[1].body).toEqual({ newPassword: NEW_PW, token: TOKEN });
    for (const c of h.calls) expect(c.headers.get('origin')).toBe(SITE);
    expect(h.out).toEqual([
      'Reset email sent to admin@example.com (from Neon). Open it, copy the link, paste it below.',
      'password set for admin@example.com',
    ]);
    expect(h.asked).toHaveLength(3);
    const printed = [...h.out, ...h.err, ...h.asked].join('\n');
    expect(printed).not.toContain(TOKEN);
    expect(printed).not.toContain(NEW_PW);
  });

  it('a failed reset prints status + code only, never the token or password', async () => {
    const h = harness({ routes: { 'POST /neondb/auth/reset-password': () => json(400, { code: 'INVALID_TOKEN', message: `bad ${TOKEN}` }) } });
    expect(await resetPasswordMain(h.deps)).toBe(1);
    expect(h.err).toEqual(['reset-password: reset-password failed: status 400 INVALID_TOKEN']);
    expect(h.err.join('\n')).not.toMatch(new RegExp(`${TOKEN}|${NEW_PW}`));
  });

  it('a failed email request stops before any prompt', async () => {
    const h = harness({ routes: { 'POST /neondb/auth/request-password-reset': () => json(403, { code: 'INVALID_ORIGIN' }) } });
    expect(await resetPasswordMain(h.deps)).toBe(1);
    expect(h.err).toEqual(['reset-password: request-password-reset failed: status 403 INVALID_ORIGIN']);
    expect(h.asked).toHaveLength(0);
  });

  it('refuses a junk link or mismatched passwords without calling reset-password', async () => {
    const junk = harness({ answers: ['hello'] });
    expect(await resetPasswordMain(junk.deps)).toBe(1);
    expect(junk.calls).toHaveLength(1);
    const mismatch = harness({ answers: [`${SITE}/login?token=${TOKEN}`, NEW_PW, 'other-password'] });
    expect(await resetPasswordMain(mismatch.deps)).toBe(1);
    expect(mismatch.calls).toHaveLength(1);
    expect(mismatch.err.join('\n')).toMatch(/match/);
  });
});
