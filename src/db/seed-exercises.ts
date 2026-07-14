import { exercises } from './schema';
import type { Db } from './types';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const DEFAULT_IMAGE_MAP: Record<string, string> = {
  // Spine conditioning program
  'Head Rolls': '/images/exercises/neck-stretch.png',
  'Kneeling Back Extension': '/images/exercises/kneeling-back-extension.png',
  'Sitting Rotation Stretch': '/images/exercises/sitting-rotation-stretch.png',
  'Modified Seat Side Straddle': '/images/exercises/modified-seat-side-straddle.png',
  'Knee to Chest': '/images/exercises/knee-to-chest.png',
  'Bird Dog': '/images/exercises/bird-dog.png',
  'Plank': '/images/exercises/plank.png',
  'Modified Side Plank': '/images/exercises/modified-side-plank.png',
  'Hip Bridge': '/images/exercises/hip-bridge.png',
  'Abdominal Bracing': '/images/exercises/abdominal-bracing.png',
  'Abdominal Crunch': '/images/exercises/abdominal-crunch.png',

  // Shoulder conditioning program
  'Pendulum': '/images/exercises/pendulum.png',
  'Crossover Arm Stretch': '/images/exercises/crossover-arm-stretch.png',
  'Passive Internal Rotation': '/images/exercises/passive-internal-rotation.png',
  'Passive External Rotation': '/images/exercises/passive-external-rotation.png',
  'Sleeper Stretch': '/images/exercises/sleeper-stretch.png',
  'Standing Row': '/images/exercises/standing-row.png',
  'External Rotation With Arm Abducted 90°': '/images/exercises/external-rotation-abducted-90.png',
  'Internal Rotation (Band)': '/images/exercises/internal-rotation-band.png',
  'External Rotation (Band)': '/images/exercises/external-rotation-band.png',
  'Elbow Flexion': '/images/exercises/elbow-flexion.png',
  'Elbow Extension': '/images/exercises/elbow-extension.png',
  'Trapezius Strengthening': '/images/exercises/trapezius-strengthening.png',
  'Scapula Setting': '/images/exercises/scapula-setting.png',
  'Scapular Retraction/Protraction': '/images/exercises/scapular-retraction-protraction.png',
  'Bent-Over Horizontal Abduction': '/images/exercises/bent-over-horizontal-abduction.png',
  'Internal and External Rotation': '/images/exercises/internal-and-external-rotation.png',
  'External Rotation (Dumbbell)': '/images/exercises/external-rotation-dumbbell.png',
  'Internal Rotation (Dumbbell)': '/images/exercises/internal-rotation-dumbbell.png',
};

const SEED_FILES = [
  'spine-conditioning-program.json',
  'rotator-cuff-and-shoulder-conditioning-program.json',
];

type SeedExercise = {
  name: string;
  nameMr: string;
  category: string;
  description?: string;
  descriptionMr?: string;
  repetitions: string;
  repetitionsMr: string;
  daysPerWeek: string;
  daysPerWeekMr: string;
  steps: string[];
  stepsMr: string[];
  tip?: string;
  tipMr?: string;
};

type SeedOptions = {
  imageMap?: Record<string, string>;
  seedDir?: string;
};

function isSameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}

export async function seedExercises(db: Db, options: SeedOptions = {}): Promise<void> {
  const imageMap = options.imageMap ?? DEFAULT_IMAGE_MAP;
  const seedDir = options.seedDir ?? path.resolve(process.cwd(), 'src/db/seed-data');

  try {
    const seedItems: SeedExercise[] = [];
    for (const file of SEED_FILES) {
      const jsonPath = path.join(seedDir, file);
      if (!fs.existsSync(jsonPath)) {
        console.warn(`Seed JSON file not found at: ${jsonPath}`);
        continue;
      }
      let data: { exercises: SeedExercise[] };
      try {
        data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as { exercises: SeedExercise[] };
      } catch (parseError) {
        throw new Error(`Invalid JSON in seed file ${file}: ${String(parseError)}`);
      }
      seedItems.push(...data.exercises);
    }

    const existingRows = await db.select().from(exercises);
    const existingByName = new Map(existingRows.map((row) => [row.name, row]));

    let inserted = 0;
    let updated = 0;
    // Transaction: a mid-loop failure must not leave the library half-synced
    // (scripts/seed-db.ts runs this against the real database).
    await db.transaction(async (tx) => {
      for (const item of seedItems) {
        const existing = existingByName.get(item.name);
        const values = {
          nameMr: item.nameMr,
          category: item.category,
          description: item.description ?? null,
          descriptionMr: item.descriptionMr ?? null,
          repetitions: item.repetitions,
          repetitionsMr: item.repetitionsMr,
          daysPerWeek: item.daysPerWeek,
          daysPerWeekMr: item.daysPerWeekMr,
          steps: item.steps,
          stepsMr: item.stepsMr,
          tip: item.tip ?? null,
          tipMr: item.tipMr ?? null,
          // Never null out an image the DB already has just because the map lacks an entry.
          imagePath: imageMap[item.name] ?? existing?.imagePath ?? null,
        };

        if (!existing) {
          await tx.insert(exercises).values({ name: item.name, ...values });
          inserted++;
        } else if (
          Object.entries(values).some(
            ([key, value]) => !isSameValue(value, existing[key as keyof typeof existing]),
          )
        ) {
          await tx.update(exercises).set(values).where(eq(exercises.name, item.name));
          updated++;
        }
      }
    });

    // Rows are keyed by name: renaming an exercise in the seed JSON inserts a new
    // row and strands the old one (existing prescriptions keep pointing at it).
    // Surface strays so a rename gets noticed and reconciled manually.
    const seedNames = new Set(seedItems.map((item) => item.name));
    const orphaned = existingRows.filter((row) => !seedNames.has(row.name)).map((row) => row.name);
    if (orphaned.length > 0) {
      console.warn(
        `Exercises in DB but absent from seed JSON (renamed or removed?): ${orphaned.join(', ')}`,
      );
    }

    console.log(`Exercises seeded: ${inserted} inserted, ${updated} updated.`);
  } catch (error) {
    console.error('Failed to seed exercises:', error);
  }
}
