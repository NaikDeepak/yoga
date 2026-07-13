import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Patient } from '@/db/schema';

vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock('@/db/client', () => ({ getDb: vi.fn(() => ({})) }));
vi.mock('@/data/patients', () => ({ getPatient: vi.fn() }));
vi.mock('@/data/problems', () => ({ listProblems: vi.fn() }));
vi.mock('@/data/lifestyle', () => ({ getLifestyleAssessment: vi.fn() }));
vi.mock('@/data/visits', () => ({ listVisits: vi.fn() }));
vi.mock('@/lib/gemini', () => ({ generateTreatmentDraft: vi.fn() }));

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPatient } from '@/data/patients';
import { listProblems } from '@/data/problems';
import { getLifestyleAssessment } from '@/data/lifestyle';
import { listVisits } from '@/data/visits';
import { generateTreatmentDraft } from '@/lib/gemini';
import { GET } from '@/app/api/ai/treatment-plan/[patientId]/route';

const MOCK_PATIENT = {
  id: 'patient-1',
  fullName: 'Asha Pawar',
  patientCode: 'PYT-0001',
  age: 45,
  gender: 'female',
  weightKg: 65,
  heightCm: 160,
  mobile: '9876543210',
  email: null,
  address: null,
  occupation: null,
  emergencyContact: null,
  branch: null,
  photoPath: null,
  birthDate: null,
  createdAt: new Date(),
} satisfies Patient;

const MOCK_DRAFT = {
  yogaProgram: 'Gentle yoga.',
  pranayam: 'Nadi Shodhana.',
  massage: 'Lower back.',
  yogaTherapy: 'Bridge pose.',
  dietPlan: 'Anti-inflammatory.',
  medicines: 'Ashwagandha.',
  panchkarma: '',
};

let mockGetUser: ReturnType<typeof vi.fn>;

function makeRequest() {
  return new Request('http://localhost/api/ai/treatment-plan/patient-1');
}
function makeParams(patientId = 'patient-1') {
  return { params: Promise.resolve({ patientId }) };
}

beforeEach(() => {
  mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } });
  vi.mocked(createSupabaseServerClient).mockResolvedValue(
    { auth: { getUser: mockGetUser } } as any,
  );
  vi.mocked(getPatient).mockResolvedValue(MOCK_PATIENT);
  vi.mocked(listProblems).mockResolvedValue([]);
  vi.mocked(getLifestyleAssessment).mockResolvedValue(undefined);
  vi.mocked(listVisits).mockResolvedValue([]);
  vi.mocked(generateTreatmentDraft).mockResolvedValue(MOCK_DRAFT);
});

describe('GET /api/ai/treatment-plan/[patientId]', () => {
  it('returns 200 with 7-field draft on success', async () => {
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(MOCK_DRAFT);
  });

  it('returns 401 JSON when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('Unauthorized') });
  });

  it('returns 404 JSON when patient does not exist', async () => {
    vi.mocked(getPatient).mockResolvedValue(undefined);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'Patient not found / रुग्ण सापडला नाही' });
  });

  it('returns 500 JSON when Gemini throws', async () => {
    vi.mocked(generateTreatmentDraft).mockRejectedValue(new Error('Rate limited by Gemini'));
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'AI generation failed. Please try again. / AI योजना तयार करण्यात त्रुटी आली. कृपया पुन्हा प्रयत्न करा.' });
  });
});
