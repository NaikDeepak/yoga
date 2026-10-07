import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }));
vi.mock('@/db/client', () => ({ getDb: vi.fn(() => ({})) }));
vi.mock('@/data/capture-stats', () => ({ recordCaptureCounts: vi.fn() }));

import { getSessionUser } from '@/lib/auth';
import { recordCaptureCounts } from '@/data/capture-stats';
import { POST } from '@/app/api/telemetry/capture/route';

const post = (body: string) => new Request('http://localhost/api/telemetry/capture', { method: 'POST', body });
const batch = JSON.stringify({ counts: [{ event: 'captured', shot: 'front', n: 1 }] });

beforeEach(() => {
  vi.mocked(getSessionUser).mockResolvedValue({ id: 'u1', email: 'a@b.c' });
  vi.mocked(recordCaptureCounts).mockReset();
});

describe('POST /api/telemetry/capture', () => {
  it('records a valid batch under today (IST)', async () => {
    const res = await POST(post(batch));
    expect(res.status).toBe(204);
    expect(recordCaptureCounts).toHaveBeenCalledWith({}, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), [{ event: 'captured', shot: 'front', n: 1 }]);
  });

  it('needs a signed-in user', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);
    expect((await POST(post(batch))).status).toBe(401);
    expect(recordCaptureCounts).not.toHaveBeenCalled();
  });

  it('rejects bad JSON, unknown events and oversized bodies without recording', async () => {
    expect((await POST(post('{nope'))).status).toBe(400);
    expect((await POST(post(JSON.stringify({ counts: [{ event: 'x', shot: 'front', n: 1 }] })))).status).toBe(400);
    expect((await POST(post('x'.repeat(20_000)))).status).toBe(413);
    expect(recordCaptureCounts).not.toHaveBeenCalled();
  });

  it('answers 500 without detail when the database fails', async () => {
    vi.mocked(recordCaptureCounts).mockRejectedValue(new Error('select * from secret'));
    const res = await POST(post(batch));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('secret');
  });
});
