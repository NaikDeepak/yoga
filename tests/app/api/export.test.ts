import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }));
vi.mock('@/db/client', () => ({ getDb: vi.fn(() => ({})) }));
vi.mock('@/data/export', () => ({
  exportClients: vi.fn(),
  exportVisits: vi.fn(),
  exportFees: vi.fn(),
}));

import { getSessionUser } from '@/lib/auth';
import { exportClients, exportVisits, exportFees } from '@/data/export';
import { GET } from '@/app/api/export/[kind]/route';

function makeRequest(kind: string, branch?: string) {
  const url = branch !== undefined
    ? `http://localhost/api/export/${kind}?branch=${encodeURIComponent(branch)}`
    : `http://localhost/api/export/${kind}`;
  return new Request(url);
}

function makeParams(kind: string) {
  return { params: Promise.resolve({ kind }) };
}

beforeEach(() => {
  vi.mocked(getSessionUser).mockResolvedValue({ id: 'staff-1' } as any);
  vi.mocked(exportClients).mockResolvedValue({
    header: ['Client code', 'Name'],
    rows: [['PYT-0001', 'Asha']],
  });
  vi.mocked(exportVisits).mockResolvedValue({
    header: ['Client code', 'Name', 'Visit date'],
    rows: [['PYT-0001', 'Asha', '2026-10-01']],
  });
  vi.mocked(exportFees).mockResolvedValue({
    header: ['Client code', 'Name', 'Course fee'],
    rows: [['PYT-0001', 'Asha', 5000]],
  });
});

describe('GET /api/export/[kind]', () => {
  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);
    const res = await GET(makeRequest('clients'), makeParams('clients'));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('Unauthorized') });
  });

  it('returns 404 for an unknown export kind', async () => {
    const res = await GET(makeRequest('unknown'), makeParams('unknown'));
    expect(res.status).toBe(404);
  });

  it('returns 400 for an unknown branch', async () => {
    const res = await GET(makeRequest('clients', 'InvalidBranch'), makeParams('clients'));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('Invalid branch') });
  });

  it('returns 200 with CSV headers and filename for clients', async () => {
    const res = await GET(makeRequest('clients'), makeParams('clients'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const disposition = res.headers.get('content-disposition') ?? '';
    expect(disposition).toMatch(/^attachment; filename="clients-\d{4}-\d{2}-\d{2}\.csv"$/);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // UTF-8 BOM is 0xEF, 0xBB, 0xBF
    expect(bytes[0]).toBe(0xEF);
    expect(bytes[1]).toBe(0xBB);
    expect(bytes[2]).toBe(0xBF);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('Client code,Name');
    expect(text).toContain('PYT-0001,Asha');
    expect(exportClients).toHaveBeenCalledWith({}, { branch: undefined });
  });

  it('returns 200 with CSV headers and filename for visits', async () => {
    const res = await GET(makeRequest('visits', 'Kharadi'), makeParams('visits'));
    expect(res.status).toBe(200);
    const disposition = res.headers.get('content-disposition') ?? '';
    expect(disposition).toMatch(/^attachment; filename="visits-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(exportVisits).toHaveBeenCalledWith({}, { branch: 'Kharadi' });
  });

  it('returns 200 with CSV headers and filename for fees', async () => {
    const res = await GET(makeRequest('fees'), makeParams('fees'));
    expect(res.status).toBe(200);
    const disposition = res.headers.get('content-disposition') ?? '';
    expect(disposition).toMatch(/^attachment; filename="fees-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(exportFees).toHaveBeenCalledWith({}, { branch: undefined });
  });
});
