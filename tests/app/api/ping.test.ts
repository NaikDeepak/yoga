import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const execute = vi.fn();
vi.mock('@/db/client', () => ({ getDb: vi.fn(() => ({ execute })) }));

import { GET } from '@/app/api/ping/route';

const req = (auth?: string) =>
  new Request('http://localhost/api/ping', auth ? { headers: { authorization: auth } } : undefined);

describe('GET /api/ping', () => {
  beforeEach(() => {
    execute.mockReset().mockResolvedValue(undefined);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('refuses every call when CRON_SECRET is not set (fails closed)', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const res = await GET(req('Bearer anything'));
    expect(res.status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses a wrong or missing bearer token', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req('Bearer nope'))).status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it('runs the keepalive with the right token', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    const res = await GET(req('Bearer s3cret'));
    expect(execute).toHaveBeenCalledOnce();
    // Supabase URL is unset here, so auth reports false → 500; the DB part ran.
    expect(await res.json()).toMatchObject({ db: true, auth: false });
  });

  it('with LOGIN_PROVIDER=supabase still pings both Supabase endpoints', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    vi.stubEnv('LOGIN_PROVIDER', 'supabase');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await GET(req('Bearer s3cret'));
      expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
        'https://x.supabase.co/auth/v1/settings',
        'https://x.supabase.co/rest/v1/',
      ]);
      expect(await res.json()).toEqual({ ok: true, db: true, auth: true });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('with LOGIN_PROVIDER=neon makes no Supabase call and reports auth ok', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    vi.stubEnv('LOGIN_PROVIDER', 'neon');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await GET(req('Bearer s3cret'));
      expect(fetchMock).not.toHaveBeenCalled();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, db: true, auth: true });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
