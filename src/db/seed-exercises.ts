import { exercises } from './schema';
import type { Db } from './types';
import { count, eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

export async function seedExercises(db: Db): Promise<void> {
  try {
    const imageMap: Record<string, string> = {
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

    const seedFiles = [
      'spine-conditioning-program.json',
      'rotator-cuff-and-shoulder-conditioning-program.json',
    ];

    // Update existing exercises with JSON configuration details (category, image path, steps, description, etc.)
    for (const file of seedFiles) {
      const jsonPath = path.resolve(process.cwd(), `src/db/seed-data/${file}`);
      if (fs.existsSync(jsonPath)) {
        const fileContent = fs.readFileSync(jsonPath, 'utf-8');
        const data = JSON.parse(fileContent) as {
          exercises: Array<{
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
          }>;
        };

        for (const item of data.exercises) {
          await db
            .update(exercises)
            .set({
              category: item.category,
              imagePath: imageMap[item.name] ?? null,
              nameMr: item.nameMr,
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
            })
            .where(eq(exercises.name, item.name));
        }
      }
    }

    // Get all existing exercise names in the database
    const existingRows = await db.select({ name: exercises.name }).from(exercises);
    const existingNames = new Set(existingRows.map((r) => r.name));

    for (const file of seedFiles) {
      const jsonPath = path.resolve(process.cwd(), `src/db/seed-data/${file}`);
      if (!fs.existsSync(jsonPath)) {
        console.warn(`Seed JSON file not found at: ${jsonPath}`);
        continue;
      }

      const fileContent = fs.readFileSync(jsonPath, 'utf-8');
      const data = JSON.parse(fileContent) as {
        exercises: Array<{
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
        }>;
      };

      // Only insert exercises that are not already present in the DB
      const toInsert = data.exercises.filter((item) => !existingNames.has(item.name));

      if (toInsert.length > 0) {
        console.log(`Seeding ${toInsert.length} new exercises from ${file}...`);
        for (const item of toInsert) {
          await db.insert(exercises).values({
            name: item.name,
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
            imagePath: imageMap[item.name] ?? null,
          });
        }
      } else {
        console.log(`All exercises from ${file} are already seeded.`);
      }
    }

    console.log('Exercises seeded successfully.');
  } catch (error) {
    console.error('Failed to seed exercises:', error);
  }
}
