import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateTreatmentDraft, type TreatmentContext } from '@/lib/gemini';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const MOCK_DRAFT = {
  yogaProgram: 'Gentle yoga flow twice daily.',
  pranayam: 'Nadi Shodhana 10 minutes morning.',
  massage: 'Lower back with sesame oil.',
  yogaTherapy: 'Supported bridge pose.',
  dietPlan: 'Anti-inflammatory diet, avoid processed foods.',
  medicines: 'Ashwagandha 500mg twice daily.',
  panchkarma: '',
};

const MOCK_CONTEXT: TreatmentContext = {
  patient: { fullName: 'Asha Pawar', age: 45, gender: 'female', weightKg: 65, heightCm: 160 },
  bmi: 25.4,
  ailments: ['Back pain / पाठदुखी'],
  lifestyle: null,
  visits: { count: 0, latestPainScale: null, firstWeightKg: null, latestWeightKg: null },
};

function mockGeminiOk(draft: object) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(draft) }] } }],
    }),
  });
}

describe('generateTreatmentDraft', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    process.env.GEMINI_API_KEY = 'test-key';
  });
  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it('returns all 7 fields from a valid Gemini response', async () => {
    mockGeminiOk(MOCK_DRAFT);
    const result = await generateTreatmentDraft(MOCK_CONTEXT);
    expect(result).toEqual(MOCK_DRAFT);
  });

  it('includes patient name in the request body sent to Gemini', async () => {
    mockGeminiOk(MOCK_DRAFT);
    await generateTreatmentDraft(MOCK_CONTEXT);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(JSON.stringify(body)).toContain('Asha Pawar');
  });

  it('throws if GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(generateTreatmentDraft(MOCK_CONTEXT)).rejects.toThrow('GEMINI_API_KEY is not set');
  });

  it('throws on HTTP error from Gemini', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, text: async () => 'Rate limited' });
    await expect(generateTreatmentDraft(MOCK_CONTEXT)).rejects.toThrow('Gemini API error 429');
  });

  it('throws if Gemini returns no candidates', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) });
    await expect(generateTreatmentDraft(MOCK_CONTEXT)).rejects.toThrow('Gemini returned empty response');
  });

  it('includes lifestyle details in prompt when provided', async () => {
    mockGeminiOk(MOCK_DRAFT);
    const ctx: TreatmentContext = {
      ...MOCK_CONTEXT,
      lifestyle: {
        chiefComplaint: 'Lower back pain',
        duration: '3 months',
        aggravatingFactors: 'Prolonged sitting',
        relievingFactors: 'Rest and stretching',
        previousTreatment: 'Physiotherapy',
        currentMedications: 'Ibuprofen',
        doctorDiagnosis: 'Lumbar strain',
        doctorRestrictions: 'No heavy lifting',
        workType: 'Desk',
        dailySitting: '8 hours',
        activityLevel: 'Sedentary',
        sleepHours: '6 hours',
        sleepQuality: 5,
        stressLevel: 7,
        screenTime: '10 hours',
        previousExercise: 'None',
        fitnessLevel: 'Deconditioned',
        fearOfMovement: true,
        primaryGoal: 'Pain relief',
        activityStruggle: 'Bending',
        hasContraindications: true,
        contraindicationDetails: 'Spinal fusion',
      },
    };
    await generateTreatmentDraft(ctx);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toContain('Lower back pain');
    expect(prompt).toContain('3 months');
    expect(prompt).toContain('Prolonged sitting');
    expect(prompt).toContain('Spinal fusion');
  });

  it('includes visit history in prompt when count > 0', async () => {
    mockGeminiOk(MOCK_DRAFT);
    const ctx: TreatmentContext = {
      ...MOCK_CONTEXT,
      visits: { count: 3, latestPainScale: 4, firstWeightKg: 70, latestWeightKg: 65 },
    };
    await generateTreatmentDraft(ctx);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toContain('3 visits');
    expect(prompt).toContain('4/10');
    expect(prompt).toContain('70→65 kg');
  });

  it('uses system_instruction in request', async () => {
    mockGeminiOk(MOCK_DRAFT);
    await generateTreatmentDraft(MOCK_CONTEXT);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.system_instruction).toBeDefined();
    expect(body.system_instruction.parts[0].text).toContain('yoga therapy clinical assistant');
  });

  it('sets generationConfig with JSON response schema', async () => {
    mockGeminiOk(MOCK_DRAFT);
    await generateTreatmentDraft(MOCK_CONTEXT);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema).toBeDefined();
    expect(body.generationConfig.responseSchema.properties.yogaProgram).toBeDefined();
  });

  it('throws if response has no content', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: undefined }] }) });
    await expect(generateTreatmentDraft(MOCK_CONTEXT)).rejects.toThrow('Gemini returned empty response');
  });

  it('handles null values in patient context gracefully', async () => {
    mockGeminiOk(MOCK_DRAFT);
    const ctx: TreatmentContext = {
      patient: { fullName: 'Test Patient', age: null, gender: null, weightKg: null, heightCm: null },
      bmi: null,
      ailments: [],
      lifestyle: null,
      visits: { count: 0, latestPainScale: null, firstWeightKg: null, latestWeightKg: null },
    };
    await generateTreatmentDraft(ctx);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toContain('Test Patient');
    expect(prompt).toContain('?y');
    expect(prompt).toContain('unknown gender');
    expect(prompt).toContain('BMI unknown');
  });

  it('throws SyntaxError when Gemini response text is not valid JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'not valid json' }] } }],
      }),
    });
    await expect(generateTreatmentDraft(MOCK_CONTEXT)).rejects.toThrow(SyntaxError);
  });

  it('throws if Gemini returns structurally invalid JSON (missing fields)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{}' }] } }],
      }),
    });
    await expect(generateTreatmentDraft(MOCK_CONTEXT)).rejects.toThrow('Gemini response missing required field: yogaProgram');
  });

  it('uses POST method and correct URL with API key', async () => {
    mockGeminiOk(MOCK_DRAFT);
    await generateTreatmentDraft(MOCK_CONTEXT);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect(url).toContain('key=test-key');
    expect(options?.method).toBe('POST');
    expect((options as RequestInit).headers).toEqual({ 'Content-Type': 'application/json' });
  });
});
