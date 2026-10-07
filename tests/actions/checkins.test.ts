import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb } from '../helpers/action-mocks';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { saveCheckinAction } from '@/actions/checkins';
import { createShareLink, revokeShareLinks } from '@/data/share-links';
import { createPatient } from '@/data/patients';
import { listAllExercises, savePrescribedExercises } from '@/data/exercises';
import { exerciseCheckins } from '@/db/schema';
import { getISTDateString } from '@/lib/dates';
import type { Db } from '@/db/types';

let db: Db;
let patientId: string;
let token: string;

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

beforeEach(async () => {
  db = await freshTestDb();
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(requireUser).mockClear();
  patientId = (await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' })).id;
  const [ex] = await listAllExercises(db);
  await savePrescribedExercises(db, patientId, [{ exerciseId: ex.id, customNote: null }]);
  token = (await createShareLink(db, patientId, 'exercises', new Date())).token;
});
afterEach(() => vi.useRealTimers());

describe('saveCheckinAction', () => {
  it("saves today's entry for the link's client and redirects back to the page", async () => {
    await expect(saveCheckinAction(token, 'mr', form({ done: 'some', pain: '4' })))
      .rejects.toThrow(`REDIRECT:/s/${token}?lang=mr`);
    const [row] = await db.select().from(exerciseCheckins);
    expect(row).toMatchObject({ patientId, done: 'some', painScale: 4, checkinDate: getISTDateString() });
    expect(revalidatePath).toHaveBeenCalledWith(`/patients/${patientId}`);
    expect(requireUser).not.toHaveBeenCalled(); // public: the token is the key
  });

  it('ignores a date or client sent in the form', async () => {
    const otherId = (await createPatient(db, { fullName: 'Ravi', mobile: '9876500000' })).id;
    await expect(saveCheckinAction(token, 'en', form({ done: 'all', checkinDate: '2020-01-01', patientId: otherId })))
      .rejects.toThrow(/^REDIRECT:/);
    const [row] = await db.select().from(exerciseCheckins);
    expect(row).toMatchObject({ patientId, checkinDate: getISTDateString() });
  });

  it('rejects invalid answers without saving', async () => {
    // keeps the form open (edit=1) so the error shows even when today already has an entry
    await expect(saveCheckinAction(token, 'en', form({ done: 'maybe' }))).rejects.toThrow(`REDIRECT:/s/${token}?lang=en&edit=1&error=1`);
    await expect(saveCheckinAction(token, 'en', form({ done: 'all', pain: '42' }))).rejects.toThrow(/error=1/);
    expect(await db.select().from(exerciseCheckins)).toHaveLength(0);
  });

  it('refuses an over-long token before any lookup (H4)', async () => {
    await expect(saveCheckinAction('x'.repeat(5000), 'en', form({ done: 'all' }))).rejects.toThrow('REDIRECT:/s/x?lang=en');
    expect(await db.select().from(exerciseCheckins)).toHaveLength(0);
  });

  it('saves nothing for an unknown or stopped link', async () => {
    await expect(saveCheckinAction('not-a-real-token', 'mr', form({ done: 'all' }))).rejects.toThrow('REDIRECT:/s/not-a-real-token?lang=mr');
    await revokeShareLinks(db, patientId, 'exercises', new Date());
    await expect(saveCheckinAction(token, 'en', form({ done: 'all' }))).rejects.toThrow(/^REDIRECT:/);
    expect(await db.select().from(exerciseCheckins)).toHaveLength(0);
  });

  it('only allows en or mr in the redirect', async () => {
    await expect(saveCheckinAction(token, 'https://evil.test', form({ done: 'all' }))).rejects.toThrow(`REDIRECT:/s/${token}?lang=en`);
  });

  it('clears a saved pain score when the client picks no answer', async () => {
    await expect(saveCheckinAction(token, 'en', form({ done: 'all', pain: '6' }))).rejects.toThrow(/^REDIRECT:/);
    await expect(saveCheckinAction(token, 'en', form({ done: 'all', pain: '' }))).rejects.toThrow(/^REDIRECT:/);
    expect((await db.select().from(exerciseCheckins))[0].painScale).toBeNull();
  });

  it('refuses check-ins when the prescription is empty', async () => {
    await savePrescribedExercises(db, patientId, []);
    await expect(saveCheckinAction(token, 'en', form({ done: 'all' }))).rejects.toThrow(`REDIRECT:/s/${token}?lang=en`);
    expect(await db.select().from(exerciseCheckins)).toHaveLength(0);
  });

  it('keeps the day the form showed when saved just after midnight, but not a made-up day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T18:31:00Z')); // 00:01 IST on 6 Oct
    await expect(saveCheckinAction(token, 'en', form({ done: 'all', day: '2026-10-05' }))).rejects.toThrow(/^REDIRECT:/);
    await expect(saveCheckinAction(token, 'en', form({ done: 'some', day: '2026-09-01' }))).rejects.toThrow(/^REDIRECT:/);
    const rows = (await db.select().from(exerciseCheckins)).map((r) => [r.checkinDate, r.done]).sort();
    expect(rows).toEqual([['2026-10-05', 'all'], ['2026-10-06', 'some']]);
  });
});
