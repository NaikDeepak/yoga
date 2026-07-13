import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { getDashboardStats, getAilmentBreakdown, getRecentVisits, getBirthdaysToday } from '@/data/dashboard';
import { addVisit, listVisitsWithData } from '@/data/visits';
import { addPayment, setCourseFee } from '@/data/fees';
import { createPatient } from '@/data/patients';
import { addProblem } from '@/data/problems';
import type { Db } from '@/db/types';
import { getISTDateString } from '@/lib/dates';

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
    expect(stats.revenueThisMonth).toBe(0);
  });

  it('counts patients, this-month visits, most common problem, and revenue', async () => {
    const p1 = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    const p2 = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001' });

    await addVisit(db, p1.id, { visitDate: thisMonthDate(), progressNote: 'ok', weightKg: 68 });
    await addVisit(db, p1.id, { visitDate: thisMonthDate(), progressNote: 'ok', weightKg: 67 });
    await addVisit(db, p2.id, { visitDate: lastMonthDate(), progressNote: 'old' });
    await addVisit(db, p2.id, { visitDate: nextMonthDate(), progressNote: 'future' });

    await addProblem(db, p1.id, { problem: 'Back Pain', isCustom: false });
    await addProblem(db, p1.id, { problem: 'Arthritis', isCustom: false });
    await addProblem(db, p2.id, { problem: 'Back Pain', isCustom: false });

    await setCourseFee(db, p1.id, 5000);
    await setCourseFee(db, p2.id, 5000);
    await addPayment(db, p1.id, 1000, thisMonthDate(), null);
    await addPayment(db, p1.id, 500, thisMonthDate(), null);
    await addPayment(db, p2.id, 2000, lastMonthDate(), null);

    const stats = await getDashboardStats(db);
    expect(stats.totalPatients).toBe(2);
    expect(stats.visitsThisMonth).toBe(2);
    expect(stats.mostCommonProblem).toBe('Back Pain');
    expect(stats.revenueThisMonth).toBe(1500); // 1000 + 500
  });

  it('filters all stats by branch when provided', async () => {
    const p1 = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210', branch: 'Manjari BK' });
    const p2 = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001', branch: 'Kharadi' });

    await addVisit(db, p1.id, { visitDate: thisMonthDate(), progressNote: 'ok' });
    await addVisit(db, p2.id, { visitDate: thisMonthDate(), progressNote: 'ok' });
    await addProblem(db, p1.id, { problem: 'Back Pain', isCustom: false });
    await addProblem(db, p2.id, { problem: 'Arthritis', isCustom: false });

    await setCourseFee(db, p1.id, 5000);
    await setCourseFee(db, p2.id, 5000);
    await addPayment(db, p1.id, 1000, thisMonthDate(), null);
    await addPayment(db, p2.id, 2000, thisMonthDate(), null);

    const stats = await getDashboardStats(db, 'Manjari BK');
    expect(stats.totalPatients).toBe(1);
    expect(stats.visitsThisMonth).toBe(1);
    expect(stats.mostCommonProblem).toBe('Back Pain');
    expect(stats.revenueThisMonth).toBe(1000);
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

  it('filters by branch when provided', async () => {
    const p1 = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210', branch: 'Manjari BK' });
    const p2 = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001', branch: 'Kharadi' });
    await addProblem(db, p1.id, { problem: 'Back Pain', isCustom: false });
    await addProblem(db, p2.id, { problem: 'Arthritis', isCustom: false });

    const result = await getAilmentBreakdown(db, 'Manjari BK');
    expect(result).toEqual([{ problem: 'Back Pain', count: 1 }]);
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

  it('filters by branch when provided', async () => {
    const p1 = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210', branch: 'Manjari BK' });
    const p2 = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001', branch: 'Kharadi' });
    await addVisit(db, p1.id, { visitDate: '2026-06-10', progressNote: 'a' });
    await addVisit(db, p2.id, { visitDate: '2026-06-11', progressNote: 'b' });

    const result = await getRecentVisits(db, 10, 'Manjari BK');
    expect(result).toHaveLength(1);
    expect(result[0].patientName).toBe('Asha Pawar');
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

describe('getBirthdaysToday', () => {
  it('returns patients with birthday matching today (IST)', async () => {
    const todayIST = getISTDateString(0);
    const tomorrowIST = getISTDateString(1);
    const [, mm, dd] = todayIST.split('-');
    const [, tmm, tdd] = tomorrowIST.split('-');
    
    // Create patient with birthday today (year doesn't matter, e.g. 1990)
    const birthDateToday = `1990-${mm}-${dd}`;
    const p1 = await createPatient(db, {
      fullName: 'Birthday Patient 1',
      mobile: '9876543210',
      birthDate: birthDateToday,
      branch: 'Manjari BK'
    });

    // Create patient with birthday tomorrow
    const birthDateTomorrow = `1990-${tmm}-${tdd}`;
    const p1tom = await createPatient(db, {
      fullName: 'Birthday Patient Tomorrow',
      mobile: '9876543211',
      birthDate: birthDateTomorrow,
      branch: 'Manjari BK'
    });

    // Create patient with birthday not today or tomorrow
    const p2 = await createPatient(db, {
      fullName: 'Other Patient',
      mobile: '9000000001',
      birthDate: '1990-12-31'
    });

    // Create patient with no birthday
    const p3 = await createPatient(db, {
      fullName: 'No Birthday Patient',
      mobile: '9000000002'
    });

    const results = await getBirthdaysToday(db);
    expect(results).toHaveLength(2);
    
    const todayResult = results.find(r => r.id === p1.id);
    const tomResult = results.find(r => r.id === p1tom.id);
    
    expect(todayResult).toBeDefined();
    expect(todayResult?.isTomorrow).toBe(false);
    expect(tomResult).toBeDefined();
    expect(tomResult?.isTomorrow).toBe(true);

    // Test branch filter
    const manjariResults = await getBirthdaysToday(db, 'Manjari BK');
    expect(manjariResults).toHaveLength(2);

    const kharadiResults = await getBirthdaysToday(db, 'Kharadi');
    expect(kharadiResults).toHaveLength(0);
  });
});
