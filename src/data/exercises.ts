import { eq } from 'drizzle-orm';
import { exercises, prescribedExercises } from '@/db/schema';
import type { Db } from '@/db/types';
import type { Exercise } from '@/db/schema';

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
