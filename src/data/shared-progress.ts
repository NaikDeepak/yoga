// The client's progress report, for the public share page (spec 2026-10-05-progress-report-link).
// Whitelisted: nothing reaches the page unless it is listed in SharedProgressReport. Live: always
// up to `now`. Never visit notes, ailments, the plan, fees, contact details or posture photos.
import { eq } from 'drizzle-orm';
import { patients, type ShareLinkRow } from '@/db/schema';
import type { Db } from '@/db/types';
import { firstName } from '@/lib/names';
import { getISTDateString } from '@/lib/dates';
import { isPostureEnabled } from '@/lib/features';
import { adherence, painSeries, shiftDate } from '@/lib/adherence';
import { firstLatest, type DatedValue, type Recorded } from '@/lib/progress';
import { combineViews, scorePosture, type Region } from '@/lib/posture-insights';
import { compareMetrics, compareScores, type ScoreChange } from '@/lib/posture-compare';
import type { MetricKey, PostureView, Side } from '@/lib/posture';
import { listVisits } from './visits';
import { listCheckins } from './checkins';
import { firstShareDate } from './share-links';
import { getLifestyleAssessmentSnapshot } from './lifestyle';
import { getPostureAssessment, listPostureAssessments, type PostureAssessment } from './posture';

/** Days of home practice the report looks back over. */
export const HOME_WINDOW_DAYS = 30;

export interface ProgressSeries { series: Recorded[]; first: Recorded; latest: Recorded; change: number }

export interface SharedProgressReport {
  firstName: string;
  /** Date of the first visit, or null before any. */
  since: string | null;
  goal: string | null;
  sessions: number;
  /** Clinic-recorded pain (visits); null when never recorded. */
  pain: ProgressSeries | null;
  /** Clinic-recorded weight; null when never recorded or the physio ticked "Hide weight". */
  weight: ProgressSeries | null;
  /** Null when the client never had an exercise link (so there's nothing to log against). */
  home: { adherence: { score: number; days: number }; painSeries: DatedValue[] } | null;
  /** First vs latest assessment, numbers only; null with posture off or fewer than two assessments. */
  posture: {
    firstOn: string;
    latestOn: string;
    overall: ScoreChange;
    regions: Record<Region, ScoreChange>;
    /** Measures that clearly changed; readings the views disagree on are left out. */
    changes: { key: MetricKey; limbSide: Side | null; trend: 'better' | 'worse' }[];
  } | null;
}

function progressSeries(series: DatedValue[]): ProgressSeries | null {
  const fl = firstLatest(series);
  return fl && { series: series.filter((p): p is Recorded => p.value !== null), ...fl };
}

const combined = (a: PostureAssessment) => combineViews(a.views.map((v) => ({ view: v.view as PostureView, metrics: v.metrics })));

async function postureProgress(db: Db, patientId: string): Promise<SharedProgressReport['posture']> {
  const list = await listPostureAssessments(db, patientId); // newest first
  if (list.length < 2) return null;
  const [before, after] = await Promise.all([getPostureAssessment(db, list.at(-1)!.id), getPostureAssessment(db, list[0].id)]);
  if (!before || !after) return null;
  const cb = combined(before), ca = combined(after);
  const scores = compareScores(scorePosture(cb), scorePosture(ca)); // same scores as the physio's reports
  const agreed = (list: typeof cb) => list.filter((m) => !m.lowConfidence);
  return {
    firstOn: before.assessedOn,
    latestOn: after.assessedOn,
    overall: scores.overall,
    regions: scores.regions,
    changes: compareMetrics(agreed(cb), agreed(ca))
      .filter((r) => r.before && r.after && (r.trend === 'better' || r.trend === 'worse'))
      .map((r) => ({ key: r.key, limbSide: r.limbSide, trend: r.trend as 'better' | 'worse' })),
  };
}

export async function getSharedProgressReport(
  db: Db,
  link: ShareLinkRow,
  now: Date,
  env: Parameters<typeof isPostureEnabled>[0] = process.env,
): Promise<SharedProgressReport | null> {
  if (link.kind !== 'progress') return null;
  const [patient] = await db.select({ fullName: patients.fullName }).from(patients).where(eq(patients.id, link.patientId));
  if (!patient) return null;

  const today = getISTDateString(0, now);
  const [visits, lifestyle, since, checkins, posture] = await Promise.all([
    listVisits(db, link.patientId), // newest first
    getLifestyleAssessmentSnapshot(db, link.patientId),
    firstShareDate(db, link.patientId, 'exercises'),
    listCheckins(db, link.patientId, shiftDate(today, -(HOME_WINDOW_DAYS - 1)), today),
    isPostureEnabled(env) ? postureProgress(db, link.patientId) : null,
  ]);
  const oldestFirst = [...visits].reverse();

  return {
    firstName: firstName(patient.fullName),
    since: oldestFirst[0]?.visitDate ?? null,
    goal: lifestyle?.primaryGoal?.trim() || null,
    sessions: visits.length,
    pain: progressSeries(oldestFirst.map((v) => ({ date: v.visitDate, value: v.painScale }))),
    weight: link.hideWeight ? null : progressSeries(oldestFirst.map((v) => ({ date: v.visitDate, value: v.weightKg === null ? null : Number(v.weightKg) }))),
    home: since ? {
      adherence: adherence(checkins, today, HOME_WINDOW_DAYS, since),
      painSeries: painSeries(checkins, today, HOME_WINDOW_DAYS).map((p) => ({ date: p.date, value: p.pain })),
    } : null,
    posture,
  };
}
