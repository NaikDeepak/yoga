import { eq } from 'drizzle-orm';
import { exercises, patients, prescribedExercises } from '@/db/schema';
import type { Db } from '@/db/types';
import type { Exercise } from '@/db/schema';
import { resolveShareLink } from './share-links';
import { listCheckins } from './checkins';
import { dayStrip, shiftDate, type CheckinDone } from '@/lib/adherence';
import { getISTDateString } from '@/lib/dates';

export type PrescribedExercise = {
  id: string; // prescribed_exercise id
  exerciseId: string;
  name: string;
  nameMr: string;
  category: string;
  description: string | null;
  descriptionMr: string | null;
  repetitions: string;
  repetitionsMr: string;
  daysPerWeek: string;
  daysPerWeekMr: string;
  // Per-patient dose overrides; display `override ?? default`.
  repetitionsOverride: string | null;
  daysPerWeekOverride: string | null;
  steps: string[];
  stepsMr: string[];
  tip: string | null;
  tipMr: string | null;
  customNote: string | null;
  imagePath: string | null;
  createdAt: Date;
};

/**
 * Lists all exercises in the library.
 */
export async function listAllExercises(db: Db): Promise<Exercise[]> {
  return db
    .select()
    .from(exercises)
    .orderBy(exercises.category, exercises.name);
}

/**
 * Fetches exercises currently prescribed to a patient.
 */
export async function getPrescribedExercises(db: Db, patientId: string): Promise<PrescribedExercise[]> {
  const rows = await db
    .select({
      id: prescribedExercises.id,
      exerciseId: exercises.id,
      name: exercises.name,
      nameMr: exercises.nameMr,
      category: exercises.category,
      description: exercises.description,
      descriptionMr: exercises.descriptionMr,
      repetitions: exercises.repetitions,
      repetitionsMr: exercises.repetitionsMr,
      daysPerWeek: exercises.daysPerWeek,
      daysPerWeekMr: exercises.daysPerWeekMr,
      repetitionsOverride: prescribedExercises.repetitions,
      daysPerWeekOverride: prescribedExercises.daysPerWeek,
      steps: exercises.steps,
      stepsMr: exercises.stepsMr,
      tip: exercises.tip,
      tipMr: exercises.tipMr,
      customNote: prescribedExercises.customNote,
      imagePath: exercises.imagePath,
      createdAt: prescribedExercises.createdAt,
    })
    .from(prescribedExercises)
    .innerJoin(exercises, eq(prescribedExercises.exerciseId, exercises.id))
    .where(eq(prescribedExercises.patientId, patientId))
    .orderBy(exercises.category, exercises.name);

  return rows;
}

/**
 * Replaces the prescribed exercises for a patient.
 */
export async function savePrescribedExercises(
  db: Db,
  patientId: string,
  list: Array<{
    exerciseId: string;
    customNote?: string | null;
    repetitions?: string | null;
    daysPerWeek?: string | null;
  }>
): Promise<void> {
  await db.transaction(async (tx) => {
    // Delete existing prescriptions
    await tx.delete(prescribedExercises).where(eq(prescribedExercises.patientId, patientId));

    // Insert new prescriptions
    if (list.length > 0) {
      await tx.insert(prescribedExercises).values(
        list.map((item) => ({
          patientId,
          exerciseId: item.exerciseId,
          customNote: item.customNote || null,
          repetitions: item.repetitions || null,
          daysPerWeek: item.daysPerWeek || null,
        }))
      );
    }
  });
}

/**
 * Adds exercises to a patient's prescription without touching existing ones (unlike
 * savePrescribedExercises, which replaces the whole set). New rows use the library defaults.
 */
export async function addPrescribedExercises(
  db: Db,
  patientId: string,
  exerciseIds: string[],
): Promise<{ added: number; alreadyPrescribed: number }> {
  const unique = [...new Set(exerciseIds)];
  if (!unique.length) return { added: 0, alreadyPrescribed: 0 };
  const inserted = await db.insert(prescribedExercises)
    .values(unique.map((exerciseId) => ({ patientId, exerciseId })))
    .onConflictDoNothing({ target: [prescribedExercises.patientId, prescribedExercises.exerciseId] })
    // With DO NOTHING, RETURNING yields only the rows actually inserted, so this counts new additions.
    .returning({ id: prescribedExercises.id });
  return { added: inserted.length, alreadyPrescribed: unique.length - inserted.length };
}

/** What the public exercise page may show. Nothing else from the client's record reaches it. */
export type SharedExerciseProgramme = {
  linkId: string; // for the view counter
  firstName: string;
  exercises: {
    name: string;
    description: string | null;
    steps: string[];
    repetitions: string;
    daysPerWeek: string;
    tip: string | null;
    note: string | null;
    imagePath: string | null;
  }[];
  /** The client's own check-ins: today's entry and the last 7 days' answers (no past pain). */
  checkins: {
    today: { done: CheckinDone; pain: number | null } | null;
    last7: { date: string; done: CheckinDone | null }[];
  };
};

/**
 * The client's current home-exercise programme for a share-link token, in one language, or null when
 * the token is unknown, expired or revoked. Dose overrides are the physio's own text (one language).
 */
export async function getSharedExerciseProgramme(
  db: Db,
  token: string,
  lang: 'en' | 'mr',
  now: Date,
): Promise<SharedExerciseProgramme | null> {
  const link = await resolveShareLink(db, token, 'exercises', now);
  if (!link) return null;
  const [patient] = await db.select({ fullName: patients.fullName }).from(patients).where(eq(patients.id, link.patientId));
  if (!patient) return null;
  const mr = lang === 'mr';
  const today = getISTDateString(0, now);
  const [rows, recent] = await Promise.all([
    getPrescribedExercises(db, link.patientId),
    listCheckins(db, link.patientId, shiftDate(today, -6), today),
  ]);
  const todays = recent.find((c) => c.date === today);
  return {
    linkId: link.id,
    firstName: patient.fullName.trim().split(/\s+/)[0],
    exercises: rows.map((r) => ({
      name: mr ? r.nameMr : r.name,
      description: mr ? r.descriptionMr : r.description,
      steps: mr ? r.stepsMr : r.steps,
      repetitions: r.repetitionsOverride ?? (mr ? r.repetitionsMr : r.repetitions),
      daysPerWeek: r.daysPerWeekOverride ?? (mr ? r.daysPerWeekMr : r.daysPerWeek),
      tip: mr ? r.tipMr : r.tip,
      note: r.customNote,
      imagePath: r.imagePath,
    })),
    checkins: {
      today: todays ? { done: todays.done, pain: todays.pain } : null,
      last7: dayStrip(recent, today, 7),
    },
  };
}
