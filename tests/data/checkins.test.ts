import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../helpers/db';
import { createPatient } from '@/data/patients';
import { createShareLink, firstShareDate } from '@/data/share-links';
import { lastCheckinDate, listCheckins, saveCheckin } from '@/data/checkins';
import { exerciseCheckins, patients, shareLinks } from '@/db/schema';
import type { Db } from '@/db/types';

let db: Db;
let patientId: string;
let link: { id: string; patientId: string };
const now = new Date('2026-10-05T04:30:00Z');

beforeEach(async () => {
  db = await createTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' })).id;
  link = (await createShareLink(db, patientId, 'exercises', now)).link;
});

describe('saveCheckin', () => {
  it('stores one entry per day and overwrites it on a second save', async () => {
    await saveCheckin(db, link, { done: 'some', pain: 6 }, '2026-10-05');
    await saveCheckin(db, link, { done: 'all' }, '2026-10-05');
    const rows = await db.select().from(exerciseCheckins);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ patientId, shareLinkId: link.id, checkinDate: '2026-10-05', done: 'all', painScale: null });
  });

  it('keeps separate days', async () => {
    await saveCheckin(db, link, { done: 'all', pain: 3 }, '2026-10-05');
    await saveCheckin(db, link, { done: 'none' }, '2026-10-06');
    expect(await db.select().from(exerciseCheckins)).toHaveLength(2);
  });
});

describe('listCheckins', () => {
  it('returns the client\'s entries in a date range, oldest first', async () => {
    for (const [d, done] of [['2026-10-01', 'all'], ['2026-10-03', 'some'], ['2026-10-05', 'none']] as const) {
      await saveCheckin(db, link, { done }, d);
    }
    const otherId = (await createPatient(db, { fullName: 'Ravi', mobile: '9876500000' })).id;
    const other = (await createShareLink(db, otherId, 'exercises', now)).link;
    await saveCheckin(db, other, { done: 'all' }, '2026-10-03');

    const list = await listCheckins(db, patientId, '2026-10-02', '2026-10-05');
    expect(list.map((r) => [r.date, r.done])).toEqual([['2026-10-03', 'some'], ['2026-10-05', 'none']]);
  });
});

describe('lifecycle', () => {
  it('keeps check-ins when the link is deleted, and removes them with the client', async () => {
    await saveCheckin(db, link, { done: 'all' }, '2026-10-05');
    await db.delete(shareLinks).where(eq(shareLinks.id, link.id));
    expect((await db.select().from(exerciseCheckins))[0].shareLinkId).toBeNull();
    await db.delete(patients).where(eq(patients.id, patientId));
    expect(await db.select().from(exerciseCheckins)).toHaveLength(0);
  });
});

describe('firstShareDate', () => {
  it('is the IST day of the earliest link, revoked ones included', async () => {
    await createShareLink(db, patientId, 'exercises', new Date('2026-10-20T10:00:00Z')); // revokes the first
    expect(await firstShareDate(db, patientId, 'exercises')).toBe('2026-10-05');
  });

  it('is null without any link', async () => {
    const otherId = (await createPatient(db, { fullName: 'Ravi', mobile: '9876500000' })).id;
    expect(await firstShareDate(db, otherId, 'exercises')).toBeNull();
  });
});

describe('lastCheckinDate', () => {
  it("is the client's latest check-in date however old, or null", async () => {
    expect(await lastCheckinDate(db, patientId)).toBeNull();
    await saveCheckin(db, link, { done: 'all' }, '2026-06-01');
    await saveCheckin(db, link, { done: 'none' }, '2026-07-15');
    expect(await lastCheckinDate(db, patientId)).toBe('2026-07-15');
  });
});
