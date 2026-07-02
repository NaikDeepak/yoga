import { describe, it, expect, beforeEach } from 'vitest';
import { count } from 'drizzle-orm';
import { createTestDb } from '../helpers/db';
import { seedMockData } from '@/db/seed-mock';
import { patients, patientProblems, visits, lifestyleAssessments, treatmentPlans, fees, feePayments } from '@/db/schema';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

async function countRows(table: typeof patients | typeof visits) {
  const [{ n }] = await db.select({ n: count() }).from(table);
  return Number(n);
}

describe('seedMockData', () => {
  it('populates every domain table on an empty database', async () => {
    await seedMockData(db);
    expect(await countRows(patients)).toBeGreaterThan(0);
    for (const table of [patientProblems, visits, lifestyleAssessments, treatmentPlans, fees, feePayments]) {
      const [{ n }] = await db.select({ n: count() }).from(table);
      expect(Number(n)).toBeGreaterThan(0);
    }
  });

  it('is idempotent — a second run adds nothing', async () => {
    await seedMockData(db);
    const before = await countRows(patients);
    const visitsBefore = await countRows(visits);
    await seedMockData(db);
    expect(await countRows(patients)).toBe(before);
    expect(await countRows(visits)).toBe(visitsBefore);
  });

  it('seeds upcoming follow-ups so the dashboard agenda is populated', async () => {
    await seedMockData(db);
    const rows = await db.select({ next: visits.nextVisitDate }).from(visits);
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = rows.filter((r) => r.next !== null && r.next >= today);
    expect(upcoming.length).toBeGreaterThan(0);
  });
});
