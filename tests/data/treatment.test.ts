import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { createPatient } from '@/data/patients';
import { getTreatmentPlan, upsertTreatmentPlan } from '@/data/treatment';
import { treatmentSchema } from '@/lib/validation';
import type { Db } from '@/db/types';

let db: Db;
let patientId: string;
beforeEach(async () => {
  db = await createTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' })).id;
});

describe('treatment plan physio sections', () => {
  it('saves and reads the five physio sections', async () => {
    const input = treatmentSchema.parse({
      exerciseTherapy: 'Bridging 2x10',
      manualTherapy: 'Lumbar mobilisation',
      electrotherapy: 'TENS 15 min',
      homeProgramme: 'Walk 20 min',
      advice: 'Avoid long sitting',
    });
    await upsertTreatmentPlan(db, patientId, input);
    const plan = await getTreatmentPlan(db, patientId);
    expect(plan).toMatchObject({
      exerciseTherapy: 'Bridging 2x10',
      manualTherapy: 'Lumbar mobilisation',
      electrotherapy: 'TENS 15 min',
      homeProgramme: 'Walk 20 min',
      advice: 'Avoid long sitting',
      yogaProgram: null,
    });
  });

  it('keeps text in sections a later save does not post', async () => {
    await upsertTreatmentPlan(db, patientId, treatmentSchema.parse({ panchkarma: 'Basti course' }));
    await upsertTreatmentPlan(db, patientId, treatmentSchema.parse({ advice: 'Rest' }));
    const plan = await getTreatmentPlan(db, patientId);
    expect(plan?.panchkarma).toBe('Basti course');
    expect(plan?.advice).toBe('Rest');
  });
});
