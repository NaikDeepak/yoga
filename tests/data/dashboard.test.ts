import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { getDashboardStats, getAilmentBreakdown, getRecentVisits } from '@/data/dashboard';
import { addVisit, listVisitsWithData } from '@/data/visits';
import { createPatient } from '@/data/patients';
import { addProblem } from '@/data/problems';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await createTestDb(); });

function thisMonthDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`;
}

function lastMonthDate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`;
}

function nextMonthDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`;
}

describe('getDashboardStats', () => {
  it('returns zeros/nulls when empty', async () => {
    const stats = await getDashboardStats(db);
    expect(stats.totalPatients).toBe(0);
    expect(stats.visitsThisMonth).toBe(0);
    expect(stats.mostCommonProblem).toBeNull();
    expect(stats.avgPainThisMonth).toBeNull();
  });

  it('counts patients, this-month visits, most common problem, avg pain', async () => {
    const p1 = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    const p2 = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001' });

    await addVisit(db, p1.id, { visitDate: thisMonthDate(), progressNote: 'ok', weightKg: 68, painScale: 4 });
    await addVisit(db, p1.id, { visitDate: thisMonthDate(), progressNote: 'ok', weightKg: 67, painScale: 6 });
    await addVisit(db, p2.id, { visitDate: lastMonthDate(), progressNote: 'old', painScale: 8 });
    await addVisit(db, p2.id, { visitDate: nextMonthDate(), progressNote: 'future', painScale: 9 });

    await addProblem(db, p1.id, { problem: 'Back Pain', isCustom: false });
    await addProblem(db, p1.id, { problem: 'Arthritis', isCustom: false });
    await addProblem(db, p2.id, { problem: 'Back Pain', isCustom: false });

    const stats = await getDashboardStats(db);
    expect(stats.totalPatients).toBe(2);
    expect(stats.visitsThisMonth).toBe(2);
    expect(stats.mostCommonProblem).toBe('Back Pain');
    expect(stats.avgPainThisMonth).toBe(5); // (4+6)/2 = 5.0
  });
});

describe('getAilmentBreakdown', () => {
  it('returns top ailments by patient count, descending', async () => {
    const p1 = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    const p2 = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001' });

    await addProblem(db, p1.id, { problem: 'Back Pain', isCustom: false });
    await addProblem(db, p2.id, { problem: 'Back Pain', isCustom: false });
    await addProblem(db, p1.id, { problem: 'Arthritis', isCustom: false });

    const result = await getAilmentBreakdown(db);
    expect(result[0]).toEqual({ problem: 'Back Pain', count: 2 });
    expect(result[1]).toEqual({ problem: 'Arthritis', count: 1 });
  });
});

describe('getRecentVisits', () => {
  it('joins patient data and orders newest first', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    await addVisit(db, p.id, { visitDate: '2026-06-01', progressNote: 'first', weightKg: 68 });
    await addVisit(db, p.id, { visitDate: '2026-06-10', progressNote: 'second', painScale: 3 });

    const result = await getRecentVisits(db);
    expect(result).toHaveLength(2);
    expect(result[0].visitDate).toBe('2026-06-10');
    expect(result[0].patientName).toBe('Asha Pawar');
    expect(result[0].patientCode).toBe('PYT-0001');
    expect(result[0].painScale).toBe(3);
    expect(result[0].weightKg).toBeNull();
    expect(result[1].weightKg).toBe(68);
  });

  it('respects the limit parameter', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    await addVisit(db, p.id, { visitDate: '2026-06-01', progressNote: 'a' });
    await addVisit(db, p.id, { visitDate: '2026-06-02', progressNote: 'b' });
    await addVisit(db, p.id, { visitDate: '2026-06-03', progressNote: 'c' });

    const result = await getRecentVisits(db, 2);
    expect(result).toHaveLength(2);
  });
});

describe('listVisitsWithData', () => {
  it('excludes visits with no weight or pain, orders oldest first', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    await addVisit(db, p.id, { visitDate: '2026-05-01', progressNote: 'note only' });
    await addVisit(db, p.id, { visitDate: '2026-05-15', progressNote: 'with weight', weightKg: 65 });
    await addVisit(db, p.id, { visitDate: '2026-06-01', progressNote: 'with pain', painScale: 5 });

    const result = await listVisitsWithData(db, p.id);
    expect(result).toHaveLength(2);
    expect(result[0].visitDate).toBe('2026-05-15');
    expect(result[1].visitDate).toBe('2026-06-01');
  });

  it('returns empty array when no visits have metrics', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    await addVisit(db, p.id, { visitDate: '2026-06-01', progressNote: 'note only' });
    expect(await listVisitsWithData(db, p.id)).toHaveLength(0);
  });
});
