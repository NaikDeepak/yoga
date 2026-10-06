import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb, storage } from '../helpers/action-mocks';
import { addAssessment } from '../helpers/posture-assessment';
import { flexShot } from '../helpers/flexibility';
import { jpeg } from '../helpers/posture';
import { saveFlexibilityTestsAction } from '@/actions/posture';
import { createPatient } from '@/data/patients';
import { getFlexibility } from '@/data/flexibility';
import { deletePosturePhotos } from '@/data/posture';
import { requireUser } from '@/lib/auth';
import { FLEX_SHOTS, type FlexShot } from '@/lib/flexibility';
import type { Db } from '@/db/types';

let db: Db;
let patientId: string;
let assessmentId: string;

beforeEach(async () => {
  db = await freshTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha', mobile: '9876543210' })).id;
  assessmentId = (await addAssessment(db, patientId, '2026-10-04', {}, storage)).id;
});

function form(shots: readonly FlexShot[] = FLEX_SHOTS, payload?: unknown, photos: Partial<Record<FlexShot, File | null>> = {}): FormData {
  const f = new FormData();
  f.set('payload', JSON.stringify(payload ?? {
    shots: shots.map((s) => { const { photo: _photo, ...rest } = flexShot(s); return rest; }),
  }));
  for (const s of shots) {
    const p = s in photos ? photos[s] : jpeg(`${s}.jpg`);
    if (p) f.set(`photo_${s}`, p);
  }
  return f;
}

describe('saveFlexibilityTestsAction', () => {
  it('saves the shots and goes back to the report', async () => {
    await expect(saveFlexibilityTestsAction(patientId, assessmentId, form()))
      .rejects.toThrow(`REDIRECT:/patients/${patientId}/posture/${assessmentId}`);
    const r = await getFlexibility(db, assessmentId);
    expect(r.shots).toHaveLength(4);
    expect(r.scores.shoulderExtension!.score).toBe(75);
  });

  it('a retake can send just one shot', async () => {
    await expect(saveFlexibilityTestsAction(patientId, assessmentId, form(['butterfly']))).rejects.toThrow('REDIRECT:');
    expect((await getFlexibility(db, assessmentId)).shots.map((s) => s.shot)).toEqual(['butterfly']);
  });

  it('rejects malformed data, unknown shots, duplicates and a missing photo', async () => {
    expect(await saveFlexibilityTestsAction(patientId, assessmentId, form(FLEX_SHOTS, { shots: [] }))).toMatchObject({ ok: false });
    expect(await saveFlexibilityTestsAction(patientId, assessmentId, form(FLEX_SHOTS, { shots: [{ ...flexShot('butterfly'), shot: 'splits' }] }))).toMatchObject({ ok: false });
    const dup = { shots: ['butterfly', 'butterfly'].map(() => { const { photo: _p, ...rest } = flexShot('butterfly'); return rest; }) };
    expect(await saveFlexibilityTestsAction(patientId, assessmentId, form(['butterfly'], dup))).toMatchObject({ ok: false });
    expect(await saveFlexibilityTestsAction(patientId, assessmentId, form(FLEX_SHOTS, undefined, { butterfly: null }))).toMatchObject({ ok: false });
    expect((await getFlexibility(db, assessmentId)).shots).toHaveLength(0);
  });

  it('after photo consent was withdrawn, refuses without the consent tick and saves with it', async () => {
    await deletePosturePhotos(db, storage, patientId, new Date());
    expect(await saveFlexibilityTestsAction(patientId, assessmentId, form())).toMatchObject({ ok: false, error: expect.stringContaining('consent') });
    expect((await getFlexibility(db, assessmentId)).shots).toHaveLength(0);
    const withConsent = { consent: true, shots: FLEX_SHOTS.map((s) => { const { photo: _p, ...rest } = flexShot(s); return rest; }) };
    await expect(saveFlexibilityTestsAction(patientId, assessmentId, form(FLEX_SHOTS, withConsent))).rejects.toThrow('REDIRECT:');
    expect((await getFlexibility(db, assessmentId)).shots).toHaveLength(4);
  });

  it("refuses another client's assessment", async () => {
    const other = (await createPatient(db, { fullName: 'Ravi', mobile: '9876500000' })).id;
    expect(await saveFlexibilityTestsAction(other, assessmentId, form())).toMatchObject({ ok: false });
    expect((await getFlexibility(db, assessmentId)).shots).toHaveLength(0);
  });

  it('requires a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('REDIRECT:/login'));
    await expect(saveFlexibilityTestsAction(patientId, assessmentId, form())).rejects.toThrow('REDIRECT:/login');
    expect((await getFlexibility(db, assessmentId)).shots).toHaveLength(0);
  });
});
