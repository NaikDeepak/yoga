import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock('@/db/client', () => ({ getDb: vi.fn(() => ({})) }));
vi.mock('@/data/patients', () => ({ searchPatients: vi.fn() }));

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { searchPatients } from '@/data/patients';
import { GET } from '@/app/api/patients/search/route';

let mockGetUser: ReturnType<typeof vi.fn>;

function makeRequest(q?: string) {
  const url = q !== undefined
    ? `http://localhost/api/patients/search?q=${encodeURIComponent(q)}`
    : 'http://localhost/api/patients/search';
  return new Request(url);
}

beforeEach(() => {
  mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } });
  vi.mocked(createSupabaseServerClient).mockResolvedValue(
    { auth: { getUser: mockGetUser } } as any,
  );
  vi.mocked(searchPatients).mockResolvedValue([]);
});

describe('GET /api/patients/search', () => {
  it('returns 401 JSON when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest('asha'));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('Unauthorized') });
  });

  it('returns empty results without querying when q is missing', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [] });
    expect(searchPatients).not.toHaveBeenCalled();
  });

  it('returns mapped matches, capped at 8', async () => {
    vi.mocked(searchPatients).mockResolvedValue([
      {
        id: 'p1', fullName: 'Asha Pawar', patientCode: 'PYT-0001', mobile: '9876543210',
        age: null, gender: null, weightKg: null, heightCm: null, email: null, address: null,
        occupation: null, emergencyContact: null, branch: null, photoPath: null, createdAt: new Date(),
      },
    ] as any);
    const res = await GET(makeRequest('asha'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      results: [{ id: 'p1', fullName: 'Asha Pawar', patientCode: 'PYT-0001', mobile: '9876543210' }],
    });
    expect(searchPatients).toHaveBeenCalledWith({}, 'asha', 8);
  });
});
