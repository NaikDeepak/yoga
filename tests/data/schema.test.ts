import { describe, it, expect } from 'vitest';
import { createTestDb } from '../helpers/db';
import { patients, patientProblems } from '@/db/schema';

describe('schema', () => {
  it('inserts and reads a patient', async () => {
    const db = await createTestDb();
    const [row] = await db.insert(patients).values({
      patientCode: 'PYT-0001', fullName: 'Asha Pawar', mobile: '9876543210',
    }).returning();
    expect(row.id).toBeTruthy();
    expect(row.patientCode).toBe('PYT-0001');
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it('rejects duplicate patient codes', async () => {
    const db = await createTestDb();
    const base = { fullName: 'A', mobile: '9876543210' };
    await db.insert(patients).values({ ...base, patientCode: 'PYT-0001' });
    await expect(
      db.insert(patients).values({ ...base, patientCode: 'PYT-0001' }),
    ).rejects.toThrow();
  });

  it('cascades problems on patient delete', async () => {
    const db = await createTestDb();
    const [p] = await db.insert(patients).values({
      patientCode: 'PYT-0001', fullName: 'A', mobile: '9876543210',
    }).returning();
    await db.insert(patientProblems).values({ patientId: p.id, problem: 'कंबर दुखी' });
    await db.delete(patients);
    expect(await db.select().from(patientProblems)).toHaveLength(0);
  });
});
