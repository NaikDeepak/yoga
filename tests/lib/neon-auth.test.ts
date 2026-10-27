import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// The real SDK is never loaded: both entry points and next/headers are mocked, so no network.
const sdk = vi.hoisted(() => ({
  createNeonAuth: vi.fn(),
  createAuthServer: vi.fn(),
  getSession: vi.fn(),
  cookieSet: vi.fn(),
  headerGet: vi.fn(),
  extract: vi.fn(),
}));
vi.mock('@neondatabase/auth/next/server', () => ({ createNeonAuth: sdk.createNeonAuth }));
vi.mock('@neondatabase/auth/server', () => ({
  createAuthServer: sdk.createAuthServer,
  extractNeonAuthCookies: sdk.extract,
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ set: sdk.cookieSet }),
  headers: async () => ({ get: sdk.headerGet }),
}));

const SECRET = 'x'.repeat(32);

async function load() {
  vi.resetModules();
  return import('@/lib/neon-auth');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEON_AUTH_BASE_URL', 'https://auth.example.test');
  vi.stubEnv('NEON_AUTH_COOKIE_SECRET', SECRET);
  sdk.createNeonAuth.mockReturnValue({ signIn: {} });
  sdk.createAuthServer.mockReturnValue({ getSession: sdk.getSession });
  sdk.extract.mockReturnValue('__Secure-neon-auth.session_token=t');
});
afterEach(() => vi.unstubAllEnvs());

describe('getNeonAuth', () => {
  it('throws a clear error when either env var is missing', async () => {
    vi.stubEnv('NEON_AUTH_COOKIE_SECRET', '');
    const { getNeonAuth } = await load();
    expect(() => getNeonAuth()).toThrow('NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET must be set');
    vi.stubEnv('NEON_AUTH_COOKIE_SECRET', SECRET);
    vi.stubEnv('NEON_AUTH_BASE_URL', '');
    expect(() => getNeonAuth()).toThrow('NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET must be set');
    expect(sdk.createNeonAuth).not.toHaveBeenCalled();
  });
  it('builds once on first use, from the env', async () => {
    const { getNeonAuth } = await load();
    expect(sdk.createNeonAuth).not.toHaveBeenCalled();
    const a = getNeonAuth();
    expect(getNeonAuth()).toBe(a);
    expect(sdk.createNeonAuth).toHaveBeenCalledTimes(1);
    expect(sdk.createNeonAuth).toHaveBeenCalledWith({
      baseUrl: 'https://auth.example.test',
      cookies: { secret: SECRET },
    });
  });
});

describe('readNeonSession', () => {
  it('reads uncached and maps the user to exactly { id, email }', async () => {
    sdk.getSession.mockResolvedValue({
      data: { session: { id: 's' }, user: { id: 'u1', email: 'a@b.c', name: 'A', role: 'admin' } },
      error: null,
    });
    const { readNeonSession } = await load();
    expect(await readNeonSession()).toStrictEqual({ id: 'u1', email: 'a@b.c' });
    expect(sdk.getSession).toHaveBeenCalledWith({ query: { disableCookieCache: 'true' } });
    expect(sdk.createAuthServer).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://auth.example.test', cookieSecret: SECRET }),
    );
  });
  it('maps a missing email to null', async () => {
    sdk.getSession.mockResolvedValue({ data: { session: {}, user: { id: 'u2' } }, error: null });
    const { readNeonSession } = await load();
    expect(await readNeonSession()).toStrictEqual({ id: 'u2', email: null });
  });
  it('returns null when there is no session', async () => {
    sdk.getSession.mockResolvedValue({ data: null, error: null });
    const { readNeonSession } = await load();
    expect(await readNeonSession()).toBeNull();
    sdk.getSession.mockResolvedValue({ data: { session: null, user: null }, error: null });
    expect(await readNeonSession()).toBeNull();
  });
  it('throws on a service error using only status and code (never the upstream message)', async () => {
    sdk.getSession.mockResolvedValue({
      data: null,
      error: { message: 'token=abc', status: 503, statusText: 'Unavailable', code: 'NETWORK_ERROR' },
    });
    const { readNeonSession } = await load();
    const err = await readNeonSession().catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('Neon session read failed (503 NETWORK_ERROR)');
  });
  it('builds the reader once', async () => {
    sdk.getSession.mockResolvedValue({ data: null, error: null });
    const { readNeonSession } = await load();
    await readNeonSession();
    await readNeonSession();
    expect(sdk.createAuthServer).toHaveBeenCalledTimes(1);
  });
  it('throws the env error before building the reader', async () => {
    vi.stubEnv('NEON_AUTH_BASE_URL', '');
    const { readNeonSession } = await load();
    await expect(readNeonSession()).rejects.toThrow('NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET must be set');
    expect(sdk.createAuthServer).not.toHaveBeenCalled();
  });
});

describe('the reader request context', () => {
  async function context() {
    sdk.getSession.mockResolvedValue({ data: null, error: null });
    const { readNeonSession } = await load();
    await readNeonSession();
    const { context } = sdk.createAuthServer.mock.calls[0][0];
    return context();
  }

  it('ignores cookie writes that fail during render', async () => {
    sdk.cookieSet.mockImplementation(() => {
      throw new Error('Cookies can only be modified in a Server Action or Route Handler');
    });
    const ctx = await context();
    expect(() => ctx.setCookie('n', 'v', { path: '/' })).not.toThrow();
    expect(sdk.cookieSet).toHaveBeenCalledWith('n', 'v', { path: '/' });
  });
  it('passes cookie writes through where they are allowed', async () => {
    const ctx = await context();
    ctx.setCookie('n', 'v', { httpOnly: true });
    expect(sdk.cookieSet).toHaveBeenCalledWith('n', 'v', { httpOnly: true });
  });
  it('reads the neon cookies, headers and origin from the request', async () => {
    const h: Record<string, string> = { origin: 'https://clinic.example', referer: 'https://r.example/a/b' };
    sdk.headerGet.mockImplementation((n: string) => h[n] ?? null);
    const ctx = await context();
    expect(ctx.getCookies()).toBe('__Secure-neon-auth.session_token=t');
    expect(ctx.getHeader('origin')).toBe('https://clinic.example');
    expect(ctx.getHeader('x-missing')).toBeNull();
    expect(ctx.getOrigin()).toBe('https://clinic.example');
    delete h.origin;
    expect(ctx.getOrigin()).toBe('https://r.example');
    delete h.referer;
    expect(ctx.getOrigin()).toBe('');
    expect(ctx.getFramework()).toBe('nextjs');
  });
});

describe('readNeonSessionFromRequest (proxy)', () => {
  function request(headers: Record<string, string> = {}) {
    return new NextRequest('https://clinic.example/login', {
      headers: { cookie: '__Secure-neon-auth.session_token=t; sb-x-auth-token=old', ...headers },
    });
  }

  it('reads uncached with a context built from the request, and maps the user', async () => {
    sdk.getSession.mockResolvedValue({
      data: { session: { id: 's' }, user: { id: 'u1', email: 'a@b.c', role: 'admin' } },
      error: null,
    });
    const { readNeonSessionFromRequest } = await load();
    const r = request({ origin: 'https://o.example' });
    expect(await readNeonSessionFromRequest(r)).toStrictEqual({
      user: { id: 'u1', email: 'a@b.c' },
      cookies: [],
    });
    expect(sdk.getSession).toHaveBeenCalledWith({ query: { disableCookieCache: 'true' } });
    const config = sdk.createAuthServer.mock.calls[0][0];
    expect(config).toMatchObject({ baseUrl: 'https://auth.example.test', cookieSecret: SECRET });
    const ctx = await config.context();
    expect(ctx.getCookies()).toBe('__Secure-neon-auth.session_token=t');
    expect(sdk.extract).toHaveBeenCalledWith(r.headers);
    expect(ctx.getHeader('origin')).toBe('https://o.example');
    expect(ctx.getHeader('x-missing')).toBeNull();
    expect(ctx.getOrigin()).toBe('https://o.example');
    expect(ctx.getFramework()).toBe('nextjs');
  });
  it('falls back to the request origin and never uses next/headers', async () => {
    sdk.getSession.mockResolvedValue({ data: null, error: null });
    const { readNeonSessionFromRequest } = await load();
    expect(await readNeonSessionFromRequest(request())).toStrictEqual({ user: null, cookies: [] });
    const ctx = await sdk.createAuthServer.mock.calls[0][0].context();
    expect(ctx.getOrigin()).toBe('https://clinic.example');
    ctx.setCookie('n', 'v', { path: '/' });
    expect(sdk.cookieSet).not.toHaveBeenCalled();
    expect(sdk.headerGet).not.toHaveBeenCalled();
  });
  it('collects the cookies the SDK writes, for the proxy to put on its response', async () => {
    sdk.getSession.mockImplementation(async () => {
      const ctx = await sdk.createAuthServer.mock.calls[0][0].context();
      await ctx.setCookie('__Secure-neon-auth.session_token', '', { path: '/', maxAge: 0 });
      return { data: { session: null, user: null }, error: null };
    });
    const { readNeonSessionFromRequest } = await load();
    expect(await readNeonSessionFromRequest(request())).toStrictEqual({
      user: null,
      cookies: [{ name: '__Secure-neon-auth.session_token', value: '', options: { path: '/', maxAge: 0 } }],
    });
  });
  it('throws on a service error using only status and code', async () => {
    sdk.getSession.mockResolvedValue({
      data: null,
      error: { message: 'token=abc', status: 502, statusText: 'Bad Gateway', code: 'NETWORK_ERROR' },
    });
    const { readNeonSessionFromRequest } = await load();
    await expect(readNeonSessionFromRequest(request())).rejects.toThrow(
      'Neon session read failed (502 NETWORK_ERROR)',
    );
  });
  it('throws the env error before building a reader', async () => {
    vi.stubEnv('NEON_AUTH_COOKIE_SECRET', '');
    const { readNeonSessionFromRequest } = await load();
    await expect(readNeonSessionFromRequest(request())).rejects.toThrow('must be set');
    expect(sdk.createAuthServer).not.toHaveBeenCalled();
  });
});
