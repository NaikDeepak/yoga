import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { getLifestyleAssessment, upsertLifestyleAssessment, assessmentCompletionForPatients, getLifestyleAssessmentSnapshot } from '@/data/lifestyle';
import { createPatient } from '@/data/patients';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await createTestDb(); });

describe('getLifestyleAssessment', () => {
  it('returns undefined for a patient with no assessment', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    const result = await getLifestyleAssessment(db, p.id);
    expect(result).toBeUndefined();
  });
});

describe('getLifestyleAssessmentSnapshot', () => {
  it('returns undefined for a patient with no assessment', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    const result = await getLifestyleAssessmentSnapshot(db, p.id);
    expect(result).toBeUndefined();
  });

  it('returns only the snapshot fields', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    await upsertLifestyleAssessment(db, p.id, {
      chiefComplaint: 'Back pain',
      stressLevel: 5,
      sleepQuality: 8,
      activityLevel: 'active',
      primaryGoal: 'Pain relief',
      hasContraindications: true,
      contraindicationDetails: 'High BP',
    });
    const result = await getLifestyleAssessmentSnapshot(db, p.id);
    expect(result).toBeDefined();
    expect(result).toEqual({
      stressLevel: 5,
      sleepQuality: 8,
      activityLevel: 'active',
      primaryGoal: 'Pain relief',
      hasContraindications: true,
      contraindicationDetails: 'High BP',
    });
    expect((result as any).chiefComplaint).toBeUndefined();
  });
});

describe('upsertLifestyleAssessment', () => {
  it('inserts a new row on first call', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    await upsertLifestyleAssessment(db, p.id, { chiefComplaint: 'Back pain' });
    const result = await getLifestyleAssessment(db, p.id);
    expect(result).toBeDefined();
    expect(result!.chiefComplaint).toBe('Back pain');
    expect(result!.patientId).toBe(p.id);
  });

  it('updates the existing row on second call (one row per patient)', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    await upsertLifestyleAssessment(db, p.id, { chiefComplaint: 'Knee pain' });
    await upsertLifestyleAssessment(db, p.id, { chiefComplaint: 'Back pain', duration: '3 months' });
    const result = await getLifestyleAssessment(db, p.id);
    expect(result!.chiefComplaint).toBe('Back pain');
    expect(result!.duration).toBe('3 months');
  });

  it('stores only filled fields; unfilled remain null', async () => {
    const p = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001' });
    await upsertLifestyleAssessment(db, p.id, { workType: 'desk', sleepQuality: 7 });
    const result = await getLifestyleAssessment(db, p.id);
    expect(result!.workType).toBe('desk');
    expect(result!.sleepQuality).toBe(7);
    expect(result!.chiefComplaint).toBeNull();
    expect(result!.primaryGoal).toBeNull();
  });
});

describe('assessmentCompletionForPatients', () => {
  it('returns empty object for empty input', async () => {
    expect(await assessmentCompletionForPatients(db, [])).toEqual({});
  });

  it('returns 0 for a patient with no assessment', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    const result = await assessmentCompletionForPatients(db, [p.id]);
    expect(result[p.id]).toBe(0);
  });

  it('counts filled anchor fields (0–5)', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    // Fill 3 of 5 anchor fields: chiefComplaint, currentMedications, workType
    await upsertLifestyleAssessment(db, p.id, {
      chiefComplaint: 'Back pain',
      currentMedications: 'None',
      workType: 'desk',
    });
    const result = await assessmentCompletionForPatients(db, [p.id]);
    expect(result[p.id]).toBe(3);
  });

  it('returns 5 when all anchor fields are filled', async () => {
    const p = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001' });
    await upsertLifestyleAssessment(db, p.id, {
      chiefComplaint: 'Knee pain',
      currentMedications: 'Ibuprofen',
      workType: 'standing',
      previousExercise: 'Walking',
      primaryGoal: 'Pain-free walking',
    });
    const result = await assessmentCompletionForPatients(db, [p.id]);
    expect(result[p.id]).toBe(5);
  });

  it('handles multiple patients in one query', async () => {
    const p1 = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    const p2 = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001' });
    await upsertLifestyleAssessment(db, p1.id, { chiefComplaint: 'Back pain', workType: 'desk' });
    await upsertLifestyleAssessment(db, p2.id, {
      chiefComplaint: 'Knee pain', currentMedications: 'None',
      workType: 'physical', previousExercise: 'Yoga', primaryGoal: 'Flexibility',
    });
    const result = await assessmentCompletionForPatients(db, [p1.id, p2.id]);
    expect(result[p1.id]).toBe(2);
    expect(result[p2.id]).toBe(5);
  });
});
