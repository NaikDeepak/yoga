import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import { FakeStorage } from '../helpers/fake-storage';
import { addAssessment } from '../helpers/posture-assessment';
import { createPatient } from '@/data/patients';
import { saveAiReport } from '@/data/posture';
import { addVisit } from '@/data/visits';
import { upsertLifestyleAssessment } from '@/data/lifestyle';
import { createShareLink, resolveAnyShareLink } from '@/data/share-links';
import { getSharedPostureReport } from '@/data/shared-posture';
import { MOCK_POSTURE_AI_REPORT } from '@/lib/posture-ai';
import type { Db } from '@/db/types';

let db: Db;
let storage: FakeStorage;
let patientId: string;
const now = new Date('2026-10-05T04:30:00Z');

// Right shoulder low, seen the same way from the front and the back (sides by image position).
const lowShoulder = { front: { RIGHT_SHOULDER: [400, 535] as [number, number] }, back: { LEFT_SHOULDER: [600, 535] as [number, number] } };

async function share(includePhotos = false, assessedOn = '2026-10-04', overrides: Parameters<typeof addAssessment>[3] = lowShoulder) {
  const a = await addAssessment(db, patientId, assessedOn, overrides, storage);
  const { token } = await createShareLink(db, patientId, 'posture', now, { postureAssessmentId: a.id, includePhotos });
  return { a, link: (await resolveAnyShareLink(db, token, now))! };
}

beforeEach(async () => {
  db = await createTestDb();
  storage = new FakeStorage();
  patientId = (await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210', age: 46, gender: 'female', weightKg: 70 })).id;
});

describe('getSharedPostureReport', () => {
  it('returns only the whitelisted report — no note, code, contact or draft AI', async () => {
    const { a, link } = await share();
    await saveAiReport(db, patientId, a.id, MOCK_POSTURE_AI_REPORT, { approved: false }); // draft
    const r = (await getSharedPostureReport(db, storage, link))!;
    expect(Object.keys(r).sort()).toEqual(['ai', 'assessedOn', 'firstName', 'patterns', 'photosShared', 'score', 'views', 'wellbeing']);
    expect(r).toMatchObject({ firstName: 'Asha', assessedOn: '2026-10-04', ai: null });
    const json = JSON.stringify(r);
    for (const secret of ['private physio note', 'Kulkarni', '9876543210', 'PYT-']) expect(json).not.toContain(secret);
    expect(Object.keys(r.views[0]).sort()).toEqual(['metrics', 'overlay', 'photoUrl', 'view']);
  });

  it('scores and finds the same imbalance as the physio report', async () => {
    const { link } = await share();
    const r = (await getSharedPostureReport(db, storage, link))!;
    expect(r.score.overall).toBe(93);
    expect(r.patterns.map((p) => p.key)).toContain('shoulderImbalance');
    expect(r.patterns[0]).toEqual({ key: 'shoulderImbalance', severity: 'marked' });
  });

  it("leaves out patterns the views disagree on (the physio's report flags those for a retake)", async () => {
    const { link } = await share(false, '2026-10-04', { front: { RIGHT_SHOULDER: [400, 535] } }); // back view level
    const r = (await getSharedPostureReport(db, storage, link))!;
    expect(r.patterns.map((p) => p.key)).not.toContain('shoulderImbalance');
    // ...and the same reading isn't listed or coloured under the front figure either
    const front = r.views.find((v) => v.view === 'front')!;
    expect(front.metrics.find((m) => m.key === 'shoulderLevel')?.severity).toBeNull();
  });

  it('includes the AI analysis only once approved, and only its client-facing parts', async () => {
    const { a, link } = await share();
    await saveAiReport(db, patientId, a.id, MOCK_POSTURE_AI_REPORT, { approved: true });
    const { ai } = (await getSharedPostureReport(db, storage, link))!;
    expect(Object.keys(ai!).sort()).toEqual(['recommendations', 'summary']);
    expect(ai!.summary).toBe(MOCK_POSTURE_AI_REPORT.summary);
  });

  it('has no photo URLs unless the physio included photos; then short-lived signed ones', async () => {
    const without = (await getSharedPostureReport(db, storage, (await share(false)).link))!;
    expect(without.photosShared).toBe(false);
    expect(without.views.every((v) => v.photoUrl === null)).toBe(true);

    const spy = vi.spyOn(storage, 'createSignedUrl');
    const withPhotos = (await getSharedPostureReport(db, storage, (await share(true, '2026-10-05')).link))!;
    expect(withPhotos.views.every((v) => v.photoUrl?.startsWith('https://fake.local/'))).toBe(true);
    expect(withPhotos.photosShared).toBe(true);
    expect(spy).toHaveBeenCalledWith(expect.any(String), 600);
  });

  it('marks photos as shared even if one fails to load, so the page says "unavailable", not "not shared"', async () => {
    const { link } = await share(true);
    vi.spyOn(storage, 'createSignedUrl').mockRejectedValueOnce(new Error('R2 down'));
    const r = (await getSharedPostureReport(db, storage, link))!;
    expect(r.photosShared).toBe(true);
    expect(r.views.filter((v) => v.photoUrl === null)).toHaveLength(1);
  });

  it('includes wellbeing: age/gender, weight and pain as of the assessment, BMI, stress and goal', async () => {
    await addVisit(db, patientId, { visitDate: '2026-10-01', progressNote: 'x', weightKg: 68, painScale: 4 });
    await upsertLifestyleAssessment(db, patientId, { stressLevel: 6, primaryGoal: 'Pain-free routine' } as never);
    const { wellbeing } = (await getSharedPostureReport(db, storage, (await share()).link))!;
    expect(wellbeing).toEqual({ age: 46, gender: 'female', weightKg: 68, bmi: 26.6, painScale: 4, stressLevel: 6, goal: 'Pain-free routine' });
  });

  it('is null for a link that is not a posture link', async () => {
    const { token } = await createShareLink(db, patientId, 'exercises', now);
    expect(await getSharedPostureReport(db, storage, (await resolveAnyShareLink(db, token, now))!)).toBeNull();
  });
});
