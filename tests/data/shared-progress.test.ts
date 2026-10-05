import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { FakeStorage } from '../helpers/fake-storage';
import { addAssessment } from '../helpers/posture-assessment';
import { createPatient } from '@/data/patients';
import { addVisit } from '@/data/visits';
import { setCourseFee } from '@/data/fees';
import { addProblem } from '@/data/problems';
import { upsertLifestyleAssessment } from '@/data/lifestyle';
import { saveCheckin } from '@/data/checkins';
import { createShareLink, resolveAnyShareLink } from '@/data/share-links';
import { getSharedProgressReport } from '@/data/shared-progress';
import type { Db } from '@/db/types';

let db: Db;
let patientId: string;
const now = new Date('2026-10-05T04:30:00Z'); // 10:00 IST, 5 Oct
const env = { FEATURE_POSTURE: 'true' };

async function link(opts: { hideWeight?: boolean } = {}) {
  const { token } = await createShareLink(db, patientId, 'progress', now, opts);
  return (await resolveAnyShareLink(db, token, now))!;
}

const visit = (visitDate: string, painScale: number | null, weightKg: number | null, progressNote = 'Better today') =>
  addVisit(db, patientId, { visitDate, progressNote, painScale: painScale ?? undefined, weightKg: weightKg ?? undefined });

beforeEach(async () => {
  db = await createTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210', age: 46 })).id;
});

describe('progress share links', () => {
  it('store the hide-weight choice, and point only at the client', async () => {
    const { link: row } = await createShareLink(db, patientId, 'progress', now, { hideWeight: true });
    expect(row).toMatchObject({ kind: 'progress', hideWeight: true, postureAssessmentId: null });
    const plain = await createShareLink(db, patientId, 'exercises', now);
    expect(plain.link.hideWeight).toBe(false);
  });
});

describe('getSharedProgressReport', () => {
  beforeEach(async () => {
    await visit('2026-08-01', 7, 82.4, 'private visit note: lumbar flare');
    await visit('2026-08-15', null, 81);
    await visit('2026-09-01', 5, null);
    await visit('2026-09-20', 3, 78.2);
    await visit('2026-09-25', null, null, 'session only'); // counts as a session, no data
  });

  it('returns only the whitelisted report — no notes, fees, ailments, code or contact', async () => {
    await setCourseFee(db, patientId, 4500);
    await addProblem(db, patientId, { problem: 'Sciatica', isCustom: true, note: 'Monthly package' });
    const r = (await getSharedProgressReport(db, await link(), now, env))!;
    expect(Object.keys(r).sort()).toEqual(['firstName', 'goal', 'home', 'pain', 'posture', 'sessions', 'since', 'weight']);
    const json = JSON.stringify(r);
    for (const secret of ['private visit note', 'session only', 'Kulkarni', '9876543210', 'PYT-', 'Sciatica', '4500', 'Monthly package'])
      expect(json).not.toContain(secret);
  });

  it('pain and weight: series, first → latest; sessions count every visit', async () => {
    const r = (await getSharedProgressReport(db, await link(), now, env))!;
    expect(r).toMatchObject({ firstName: 'Asha', since: '2026-08-01', sessions: 5 });
    expect(r.pain).toEqual({
      series: [{ date: '2026-08-01', value: 7 }, { date: '2026-09-01', value: 5 }, { date: '2026-09-20', value: 3 }],
      first: { date: '2026-08-01', value: 7 }, latest: { date: '2026-09-20', value: 3 }, change: -4,
    });
    expect(r.weight).toMatchObject({ first: { value: 82.4 }, latest: { value: 78.2 }, change: -4.2 });
    expect(r.weight!.series).toHaveLength(3);
  });

  it('"hide weight" leaves no weight anywhere in the report', async () => {
    const r = (await getSharedProgressReport(db, await link({ hideWeight: true }), now, env))!;
    expect(r.weight).toBeNull();
    const json = JSON.stringify(r);
    for (const kg of ['82.4', '78.2', '81']) expect(json).not.toContain(kg);
  });

  it('the main goal comes from the lifestyle form', async () => {
    await upsertLifestyleAssessment(db, patientId, { primaryGoal: '  Walk without back pain  ' } as never);
    expect((await getSharedProgressReport(db, await link(), now, env))!.goal).toBe('Walk without back pain');
  });

  it('home practice: last-30-day adherence (from their first exercise link) and pain series', async () => {
    const ex = await createShareLink(db, patientId, 'exercises', new Date('2026-09-26T04:30:00Z'));
    await saveCheckin(db, { id: ex.link.id, patientId }, { done: 'all', pain: 4 }, '2026-10-01');
    await saveCheckin(db, { id: ex.link.id, patientId }, { done: 'some', pain: 2 }, '2026-10-04');
    const r = (await getSharedProgressReport(db, await link(), now, env))!;
    expect(r.home!.adherence).toEqual({ score: 1.5, days: 10 }); // 26 Sep → 5 Oct
    expect(r.home!.painSeries).toHaveLength(30);
    expect(r.home!.painSeries.filter((p) => p.value !== null)).toEqual([
      { date: '2026-10-01', value: 4 }, { date: '2026-10-04', value: 2 },
    ]);
  });

  it('home practice is null when the client never had an exercise link', async () => {
    expect((await getSharedProgressReport(db, await link(), now, env))!.home).toBeNull();
  });

  it('is null for another kind of link or a deleted client', async () => {
    const { token } = await createShareLink(db, patientId, 'exercises', now);
    expect(await getSharedProgressReport(db, (await resolveAnyShareLink(db, token, now))!, now, env)).toBeNull();
    const l = await link();
    expect(await getSharedProgressReport(db, { ...l, patientId: '00000000-0000-0000-0000-000000000000' }, now, env)).toBeNull();
  });
});

describe('getSharedProgressReport — no visits yet', () => {
  it('still renders (live link, visits deleted later): empty series, since = null', async () => {
    const r = (await getSharedProgressReport(db, await link(), now, env))!;
    expect(r).toMatchObject({ since: null, sessions: 0, pain: null, weight: null, posture: null });
  });
});

describe('getSharedProgressReport — posture before vs now', () => {
  const storage = new FakeStorage();
  // Right shoulder low in both views (agreed), then level.
  const lowShoulder = { front: { RIGHT_SHOULDER: [400, 535] as [number, number] }, back: { LEFT_SHOULDER: [600, 535] as [number, number] } };

  it('is null with fewer than two assessments, or when posture analysis is off', async () => {
    await addAssessment(db, patientId, '2026-08-01', lowShoulder, storage);
    expect((await getSharedProgressReport(db, await link(), now, env))!.posture).toBeNull();
    await addAssessment(db, patientId, '2026-09-30', {}, storage);
    expect((await getSharedProgressReport(db, await link(), now, { FEATURE_POSTURE: 'false' }))!.posture).toBeNull();
  });

  it('compares the first and latest assessments: score, regions and what changed — numbers only', async () => {
    await addAssessment(db, patientId, '2026-08-01', lowShoulder, storage);
    await addAssessment(db, patientId, '2026-09-01', lowShoulder, storage); // middle one is skipped
    await addAssessment(db, patientId, '2026-09-30', {}, storage);
    const p = (await getSharedProgressReport(db, await link(), now, env))!.posture!;
    expect(Object.keys(p).sort()).toEqual(['changes', 'firstOn', 'latestOn', 'overall', 'regions']);
    expect(p).toMatchObject({ firstOn: '2026-08-01', latestOn: '2026-09-30', overall: { before: 93, after: 100, change: 7 } });
    expect(p.regions.shoulders).toMatchObject({ change: expect.any(Number) });
    expect(p.changes).toContainEqual({ key: 'shoulderLevel', limbSide: null, trend: 'better' });
    expect(p.changes.every((c) => c.trend === 'better' || c.trend === 'worse')).toBe(true);
    const json = JSON.stringify(p);
    for (const secret of ['private physio note', 'landmarks', 'filePath', 'photo']) expect(json).not.toContain(secret);
  });

  it('leaves out readings the views disagree on', async () => {
    await addAssessment(db, patientId, '2026-08-01', { front: { RIGHT_SHOULDER: [400, 535] } }, storage); // back view level
    await addAssessment(db, patientId, '2026-09-30', {}, storage);
    const p = (await getSharedProgressReport(db, await link(), now, env))!.posture!;
    expect(p.changes.map((c) => c.key)).not.toContain('shoulderLevel');
  });
});
