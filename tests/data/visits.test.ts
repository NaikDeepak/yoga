import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { addVisit, getFollowUpsThisWeek, getFollowUpsInRange, getISTDateString } from '@/data/visits';
import { createPatient } from '@/data/patients';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await createTestDb(); });

describe('getFollowUpsThisWeek', () => {
  it('includes a follow-up scheduled for today', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    await addVisit(db, p.id, {
      visitDate: getISTDateString(0),
      progressNote: 'note',
      nextVisitDate: getISTDateString(0),
    });

    const result = await getFollowUpsThisWeek(db);
    expect(result.map((f) => f.patientId)).toContain(p.id);
  });

  it('includes a follow-up scheduled exactly 7 days out', async () => {
    const p = await createPatient(db, { fullName: 'Jane Doe', mobile: '9000000002' });
    await addVisit(db, p.id, {
      visitDate: getISTDateString(0),
      progressNote: 'note',
      nextVisitDate: getISTDateString(7),
    });

    const result = await getFollowUpsThisWeek(db);
    expect(result.map((f) => f.patientId)).toContain(p.id);
  });

  it('excludes a follow-up scheduled 8 days out', async () => {
    const p = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000003' });
    await addVisit(db, p.id, {
      visitDate: getISTDateString(0),
      progressNote: 'note',
      nextVisitDate: getISTDateString(8),
    });

    const result = await getFollowUpsThisWeek(db);
    expect(result.map((f) => f.patientId)).not.toContain(p.id);
  });

  it('ignores a future-dated (not-yet-attended) visit when finding the latest one', async () => {
    // Mirrors a real production case: a patient has a today's visit that scheduled a
    // real follow-up, plus a separate visit row dated further in the future (not yet
    // attended — e.g. a placeholder/test row) with no next-visit-date set. That
    // not-yet-happened row must not be treated as "the latest visit" and clear the
    // real follow-up that came from an actual visit.
    const p = await createPatient(db, { fullName: 'Jane Doe', mobile: '9000000004' });

    await addVisit(db, p.id, {
      visitDate: getISTDateString(0),
      progressNote: 'visit with a real follow-up',
      nextVisitDate: getISTDateString(7),
    });
    // Dated further in the future than today — hasn't happened yet.
    await addVisit(db, p.id, {
      visitDate: getISTDateString(4),
      progressNote: 'future-dated visit with no follow-up',
    });

    const result = await getFollowUpsThisWeek(db);
    const entry = result.find((f) => f.patientId === p.id);
    expect(entry?.nextVisitDate).toBe(getISTDateString(7));
  });

  it('excludes a patient who has no next-visit-date set on any visit', async () => {
    const p = await createPatient(db, { fullName: 'No Followup', mobile: '9000000005' });
    await addVisit(db, p.id, { visitDate: getISTDateString(0), progressNote: 'note' });

    const result = await getFollowUpsThisWeek(db);
    expect(result.map((f) => f.patientId)).not.toContain(p.id);
  });

  it('filters by branch when provided', async () => {
    const p1 = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210', branch: 'Manjari BK' });
    const p2 = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001', branch: 'Kharadi' });
    await addVisit(db, p1.id, { visitDate: getISTDateString(0), progressNote: 'a', nextVisitDate: getISTDateString(1) });
    await addVisit(db, p2.id, { visitDate: getISTDateString(0), progressNote: 'b', nextVisitDate: getISTDateString(1) });

    const result = await getFollowUpsThisWeek(db, 'Manjari BK');
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe('Asha Pawar');
  });
});

describe('getFollowUpsInRange', () => {
  it('returns follow-ups within an arbitrary range beyond a week', async () => {
    const p = await createPatient(db, { fullName: 'Month Browser', mobile: '9000000007' });
    await addVisit(db, p.id, {
      visitDate: getISTDateString(0),
      progressNote: 'note',
      nextVisitDate: getISTDateString(20),
    });

    const result = await getFollowUpsInRange(db, getISTDateString(15), getISTDateString(25));
    expect(result.map((f) => f.patientId)).toContain(p.id);
  });

  it('excludes a follow-up outside the given range', async () => {
    const p = await createPatient(db, { fullName: 'Out Of Range', mobile: '9000000008' });
    await addVisit(db, p.id, {
      visitDate: getISTDateString(0),
      progressNote: 'note',
      nextVisitDate: getISTDateString(50),
    });

    const result = await getFollowUpsInRange(db, getISTDateString(15), getISTDateString(25));
    expect(result.map((f) => f.patientId)).not.toContain(p.id);
  });

  it('uses real today — not the range start — as the cutoff for the latest-visit lookup, even when browsing a future range', async () => {
    const p = await createPatient(db, { fullName: 'Future Browser', mobile: '9000000009' });
    // A real visit happening today, with a real follow-up far in the future.
    await addVisit(db, p.id, {
      visitDate: getISTDateString(0),
      progressNote: 'visit with a real follow-up',
      nextVisitDate: getISTDateString(40),
    });
    // A later, not-yet-attended visit row dated inside the browsed future range, with no follow-up.
    await addVisit(db, p.id, {
      visitDate: getISTDateString(35),
      progressNote: 'future-dated visit with no follow-up',
    });

    const result = await getFollowUpsInRange(db, getISTDateString(30), getISTDateString(45));
    const entry = result.find((f) => f.patientId === p.id);
    expect(entry?.nextVisitDate).toBe(getISTDateString(40));
  });

  it('filters by branch when provided', async () => {
    const p1 = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543211', branch: 'Manjari BK' });
    const p2 = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000010', branch: 'Kharadi' });
    await addVisit(db, p1.id, { visitDate: getISTDateString(0), progressNote: 'a', nextVisitDate: getISTDateString(20) });
    await addVisit(db, p2.id, { visitDate: getISTDateString(0), progressNote: 'b', nextVisitDate: getISTDateString(20) });

    const result = await getFollowUpsInRange(db, getISTDateString(15), getISTDateString(25), 'Manjari BK');
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe('Asha Pawar');
  });
});
