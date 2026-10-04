import { describe, it, expect, beforeEach } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb, storage } from '../helpers/action-mocks';
import { alignedLandmarks, jpeg } from '../helpers/posture';
import { generatePostureAiAction } from '@/actions/posture';
import { createPatient } from '@/data/patients';
import { addPostureAssessment, getPostureAssessment } from '@/data/posture';
import { POSTURE_VIEWS } from '@/lib/posture';

// Separate file on purpose: the real Gemini client (no API key, not mock mode) throws, so this
// exercises the action's error handling without a throwing vi.fn (which Vitest reports as an error).
describe('generatePostureAiAction — AI failure', () => {
  beforeEach(() => { delete process.env.GEMINI_API_KEY; });

  it('reports the failure and saves nothing', async () => {
    const db = await freshTestDb();
    const patientId = (await createPatient(db, { fullName: 'Asha', mobile: '9876543210' })).id;
    const { id } = await addPostureAssessment(db, storage, {
      patientId, assessedOn: '2026-10-04', heightCm: 160, note: null, consentAt: new Date(),
      views: POSTURE_VIEWS.map((v) => ({
        view: v, photo: jpeg(), imageWidth: 1000, imageHeight: 2000, landmarks: alignedLandmarks(v),
        landmarksEdited: false, cameraCheck: null,
      })),
    });
    expect(await generatePostureAiAction(patientId, id)).toEqual({
      ok: false, error: 'AI analysis failed. Please try again. / AI विश्लेषण अयशस्वी झाले. कृपया पुन्हा प्रयत्न करा.',
    });
    expect((await getPostureAssessment(db, id))!.aiReport).toBeNull();
  });
});
