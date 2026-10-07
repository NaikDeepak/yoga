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
});
