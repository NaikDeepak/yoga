import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// No real auth service: the Neon module and the Supabase client are both mocked.
const neon = vi.hoisted(() => ({
  middleware: vi.fn(),
  readNeonSessionFromRequest: vi.fn(),
}));
vi.mock('@/lib/neon-auth', () => ({
  getNeonAuth: () => ({ middleware: neon.middleware }),
  readNeonSessionFromRequest: neon.readNeonSessionFromRequest,
}));
const supa = vi.hoisted(() => ({ getUser: vi.fn(), createServerClient: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: supa.createServerClient }));

import { updateSession, NEON_SESSION_COOKIE } from '@/lib/session-middleware';

const NEON_COOKIE = `${NEON_SESSION_COOKIE}=tok`;

function req(path: string, cookie?: string) {
  return new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie } } : undefined);
}
function location(res: Response) {
  const loc = res.headers.get('location');
  return loc ? new URL(loc).pathname : null;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('updateSession (neon)', () => {
  beforeEach(() => {
    vi.stubEnv('LOCAL_MOCK', 'false');
    vi.stubEnv('LOGIN_PROVIDER', 'neon');
  });

  it('matches the SDK session cookie name', async () => {
    const sdk = await import('@neondatabase/auth/server');
    expect(NEON_SESSION_COOKIE).toBe(sdk.NEON_AUTH_SESSION_COOKIE_NAME);
  });

  it('sends a page without a session to /login, without calling the auth service', async () => {
    const res = await updateSession(req('/dashboard'));
    expect(res.status).toBe(307);
    expect(location(res)).toBe('/login');
    expect(neon.middleware).not.toHaveBeenCalled();
    expect(neon.readNeonSessionFromRequest).not.toHaveBeenCalled();
  });

  it('sends a request carrying only old Supabase cookies to /login', async () => {
    const res = await updateSession(
      req('/dashboard', 'sb-abc-auth-token=base64-xyz; sb-abc-auth-token.0=part'),
    );
    expect(res.status).toBe(307);
    expect(location(res)).toBe('/login');
    expect(neon.middleware).not.toHaveBeenCalled();
  });

  it.each(['/s/abc', '/login', '/manifest.webmanifest'])(
    'lets %s through without a session',
    async (path) => {
      const res = await updateSession(req(path));
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
      expect(neon.middleware).not.toHaveBeenCalled();
      expect(neon.readNeonSessionFromRequest).not.toHaveBeenCalled();
    },
  );

  it('lets /api/* through untouched (the route answers its own 401), even with a cookie', async () => {
    for (const cookie of [undefined, NEON_COOKIE]) {
      const res = await updateSession(req('/api/patients/search', cookie));
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    }
    expect(neon.middleware).not.toHaveBeenCalled();
    expect(neon.readNeonSessionFromRequest).not.toHaveBeenCalled();
  });

  it('does not check the session on a public share link that carries a cookie', async () => {
    const res = await updateSession(req('/s/abc', NEON_COOKIE));
    expect(res.status).toBe(200);
    expect(neon.middleware).not.toHaveBeenCalled();
  });

  it('reads a protected page uncached and lets a valid user through with refreshed cookies', async () => {
    neon.readNeonSessionFromRequest.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.c' },
      cookies: [{ name: NEON_SESSION_COOKIE, value: 'new', options: { path: '/', secure: true } }],
    });
    const request = req('/patients/abc', NEON_COOKIE);
    const res = await updateSession(request);
    expect(neon.readNeonSessionFromRequest).toHaveBeenCalledWith(request);
    expect(neon.middleware).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(res.cookies.get(NEON_SESSION_COOKIE)?.value).toBe('new');
  });

  it('sends a revoked session to /login even with a session_data cache cookie, clearing the neon cookies', async () => {
    neon.readNeonSessionFromRequest.mockResolvedValue({ user: null, cookies: [] });
    const res = await updateSession(
      req(
        '/dashboard',
        `${NEON_COOKIE}; __Secure-neon-auth.local.session_data=signed-copy; sb-x-auth-token=old`,
      ),
    );
    expect(res.status).toBe(307);
    expect(location(res)).toBe('/login');
    expect(neon.middleware).not.toHaveBeenCalled();
    const setCookie = res.headers.getSetCookie();
    for (const name of [NEON_SESSION_COOKIE, '__Secure-neon-auth.local.session_data']) {
      const c = setCookie.find((h) => h.startsWith(`${name}=;`));
      expect(c).toBeDefined();
      expect(c).toMatch(/Secure/);
      expect(c).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(c).toMatch(/Path=\//);
    }
    expect(setCookie.some((h) => h.startsWith('sb-x-auth-token'))).toBe(false);
  });

  it('sends /login with a live session to /dashboard, carrying refreshed cookies', async () => {
    neon.readNeonSessionFromRequest.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.c' },
      cookies: [{ name: 'refreshed', value: 'v', options: { path: '/', httpOnly: true } }],
    });
    const request = req('/login', NEON_COOKIE);
    const res = await updateSession(request);
    expect(neon.readNeonSessionFromRequest).toHaveBeenCalledWith(request);
    expect(neon.middleware).not.toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(location(res)).toBe('/dashboard');
    expect(res.headers.get('set-cookie')).toContain('refreshed=v');
  });

  it('keeps /login with a dead session on /login, passing on the cookie clean-up', async () => {
    neon.readNeonSessionFromRequest.mockResolvedValue({
      user: null,
      cookies: [{ name: NEON_SESSION_COOKIE, value: '', options: { path: '/', maxAge: 0 } }],
    });
    const res = await updateSession(req('/login', NEON_COOKIE));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('set-cookie')).toContain(`${NEON_SESSION_COOKIE}=;`);
  });

  it('sends a page to /login when the session check throws, logging no token', async () => {
    neon.readNeonSessionFromRequest.mockRejectedValue(new Error('fetch failed'));
    const res = await updateSession(req('/dashboard', NEON_COOKIE));
    expect(res.status).toBe(307);
    expect(location(res)).toBe('/login');
    expect(console.error).toHaveBeenCalledWith('[proxy] Neon session check failed:', 'fetch failed');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('tok');
  });

  it('sends a page to /login when the Neon module cannot be built', async () => {
    neon.readNeonSessionFromRequest.mockRejectedValue(
      new Error('NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET must be set'),
    );
    const res = await updateSession(req('/dashboard', NEON_COOKIE));
    expect(res.status).toBe(307);
    expect(location(res)).toBe('/login');
  });

  it('keeps /login on /login when the session check throws (no redirect loop)', async () => {
    neon.readNeonSessionFromRequest.mockRejectedValue(new Error('Neon session read failed (503 X)'));
    const res = await updateSession(req('/login', NEON_COOKIE));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});

describe('updateSession (mock)', () => {
  beforeEach(() => {
    vi.stubEnv('LOCAL_MOCK', 'true');
    vi.stubEnv('NODE_ENV', 'test');
  });

  it('sends a page without the mock cookie to /login and lets public paths and /api through', async () => {
    expect(location(await updateSession(req('/dashboard')))).toBe('/login');
    expect((await updateSession(req('/s/abc'))).status).toBe(200);
    expect((await updateSession(req('/api/patients/search'))).status).toBe(200);
  });
  it('sends /login with the mock cookie to /dashboard and lets pages through', async () => {
    expect(location(await updateSession(req('/login', 'mock_session=1')))).toBe('/dashboard');
    expect((await updateSession(req('/dashboard', 'mock_session=1'))).status).toBe(200);
  });
  it('never touches the Neon module or Supabase', async () => {
    await updateSession(req('/dashboard', 'mock_session=1'));
    expect(neon.middleware).not.toHaveBeenCalled();
    expect(supa.createServerClient).not.toHaveBeenCalled();
  });
});

describe('updateSession (supabase)', () => {
  let setAll: (c: { name: string; value: string; options: object }[]) => void;
  beforeEach(() => {
    vi.stubEnv('LOCAL_MOCK', 'false');
    vi.stubEnv('LOGIN_PROVIDER', 'supabase');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
    supa.createServerClient.mockImplementation((_u, _k, opts) => {
      setAll = opts.cookies.setAll;
      expect(opts.cookies.getAll()).toEqual(expect.any(Array));
      return { auth: { getUser: supa.getUser } };
    });
  });

  it('sends a page without a user to /login, carrying cleared cookies', async () => {
    supa.getUser.mockImplementation(async () => {
      setAll([{ name: 'sb-x-auth-token', value: '', options: { maxAge: 0 } }]);
      return { data: { user: null } };
    });
    const res = await updateSession(req('/dashboard'));
    expect(res.status).toBe(307);
    expect(location(res)).toBe('/login');
    expect(res.headers.get('set-cookie')).toContain('sb-x-auth-token=');
    expect(neon.middleware).not.toHaveBeenCalled();
  });
  it('lets public paths and /api through without a user', async () => {
    supa.getUser.mockResolvedValue({ data: { user: null } });
    expect((await updateSession(req('/s/abc'))).status).toBe(200);
    expect((await updateSession(req('/api/patients/search'))).status).toBe(200);
  });
  it('sends /login with a user to /dashboard and lets pages through', async () => {
    supa.getUser.mockResolvedValue({ data: { user: { id: 'u' } } });
    expect(location(await updateSession(req('/login')))).toBe('/dashboard');
    expect((await updateSession(req('/dashboard'))).status).toBe(200);
  });
});
