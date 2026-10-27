import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const neonHandler = vi.fn(async () => new Response('neon', { status: 200 }));
const handlerFactory = vi.fn(() => ({
  GET: neonHandler,
  POST: neonHandler,
  PUT: neonHandler,
  PATCH: neonHandler,
  DELETE: neonHandler,
}));
vi.mock('@/lib/neon-auth', () => ({ getNeonAuth: () => ({ handler: handlerFactory }) }));

import * as route from '@/app/api/auth/[...path]/route';

const call = (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string[]) =>
  route[method](new Request('http://localhost/api/auth/x', { method }), {
    params: Promise.resolve({ path }),
  });

describe('/api/auth/[...path]', () => {
  beforeEach(() => {
    neonHandler.mockClear();
    handlerFactory.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const)(
    '%s answers 404 for everything when the provider is not neon',
    async (method) => {
      vi.stubEnv('LOGIN_PROVIDER', 'supabase');
      const res = await call(method, ['sign-in', 'email']);
      expect(res.status).toBe(404);
      expect(handlerFactory).not.toHaveBeenCalled();
    },
  );

  it('hands an allowed path to the Neon handler', async () => {
    vi.stubEnv('LOGIN_PROVIDER', 'neon');
    const res = await call('POST', ['sign-in', 'email']);
    expect(res.status).toBe(200);
    expect(neonHandler).toHaveBeenCalledOnce();
  });

  it.each([
    ['POST', ['sign-up', 'email']],
    ['POST', ['admin', 'create-user']],
    ['GET', ['sign-in', 'email']],
    ['GET', ['get-session']],
    ['POST', ['reset-password']],
    ['POST', ['sign-up%2Femail']],
  ] as const)('answers 404 without calling Neon for %s %j', async (method, path) => {
    vi.stubEnv('LOGIN_PROVIDER', 'neon');
    const res = await call(method, [...path]);
    expect(res.status).toBe(404);
    expect(handlerFactory).not.toHaveBeenCalled();
  });

  it('answers 404 for PUT/PATCH/DELETE even on allowed paths', async () => {
    vi.stubEnv('LOGIN_PROVIDER', 'neon');
    for (const m of ['PUT', 'PATCH', 'DELETE'] as const) {
      expect((await call(m, ['sign-out'])).status).toBe(404);
    }
    expect(handlerFactory).not.toHaveBeenCalled();
  });

  it('answers 404 to HEAD sent to the GET export, without calling Neon', async () => {
    vi.stubEnv('LOGIN_PROVIDER', 'neon');
    const res = await route.GET(new Request('http://localhost/api/auth/sign-out', { method: 'HEAD' }), {
      params: Promise.resolve({ path: ['sign-out'] }),
    });
    expect(res.status).toBe(404);
    expect(neonHandler).not.toHaveBeenCalled();
  });
});
