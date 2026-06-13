import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { getLifestyleAssessment, upsertLifestyleAssessment } from '@/data/lifestyle';
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
