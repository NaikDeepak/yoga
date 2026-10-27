import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requireUser, getSessionUser } from '@/lib/auth';
import { MOCK_USER, MOCK_SESSION_COOKIE } from '@/lib/local-mock';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
}));

const getUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
}));

const cookieGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: cookieGet }),
}));

beforeEach(() => vi.clearAllMocks());

describe('requireUser', () => {
  it('returns the user when a session exists', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'admin' } } });
    expect(await requireUser()).toEqual({ id: 'admin', email: null });
  });
  it('redirects to /login when there is no session', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(requireUser()).rejects.toThrow('REDIRECT:/login');
  });
});

describe('getSessionUser', () => {
  it('returns the user without redirecting', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'admin' } } });
    expect(await getSessionUser()).toEqual({ id: 'admin', email: null });
  });
  it('returns null (no redirect) when there is no session', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getSessionUser()).toBeNull();
  });
  it('maps the supabase user to exactly { id, email }', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.c', phone: '1', app_metadata: {} } } });
    expect(await getSessionUser()).toStrictEqual({ id: 'u1', email: 'a@b.c' });
    getUser.mockResolvedValue({ data: { user: { id: 'u2' } } });
    expect(await getSessionUser()).toStrictEqual({ id: 'u2', email: null });
  });
  it('reads cookies before the provider check, even when it throws', async () => {
    const spy = vi.fn();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOGIN_PROVIDER', '');
    cookieGet.mockImplementation(spy);
    const headers = await import('next/headers');
    const cookiesSpy = vi.spyOn(headers, 'cookies');
    await expect(getSessionUser()).rejects.toThrow('LOGIN_PROVIDER must be set');
    expect(cookiesSpy).toHaveBeenCalled();
    cookiesSpy.mockRestore();
    vi.unstubAllEnvs();
  });
  it('throws for the neon provider until it is wired', async () => {
    vi.stubEnv('LOGIN_PROVIDER', 'neon');
    await expect(getSessionUser()).rejects.toThrow('Neon login is not wired yet');
    vi.unstubAllEnvs();
  });

  describe('local mock mode', () => {
    beforeEach(() => vi.stubEnv('LOCAL_MOCK', 'true'));
    afterEach(() => vi.unstubAllEnvs());

    it('returns the mock user when the cookie is present', async () => {
      cookieGet.mockReturnValue({ name: MOCK_SESSION_COOKIE, value: '1' });
      expect(await getSessionUser()).toEqual(MOCK_USER);
    });
    it('returns null when the cookie is absent', async () => {
      cookieGet.mockReturnValue(undefined);
      expect(await getSessionUser()).toBeNull();
    });
  });
});

describe('requireUser (local mock mode)', () => {
  beforeEach(() => vi.stubEnv('LOCAL_MOCK', 'true'));
  afterEach(() => vi.unstubAllEnvs());

  it('returns the mock user when the mock_session cookie is present', async () => {
    cookieGet.mockReturnValue({ name: MOCK_SESSION_COOKIE, value: '1' });
    expect(await requireUser()).toEqual(MOCK_USER);
    expect(cookieGet).toHaveBeenCalledWith(MOCK_SESSION_COOKIE);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('redirects to /login when the cookie is absent', async () => {
    cookieGet.mockReturnValue(undefined);
    await expect(requireUser()).rejects.toThrow('REDIRECT:/login');
    expect(getUser).not.toHaveBeenCalled();
  });
});
