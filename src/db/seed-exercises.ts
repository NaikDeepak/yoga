import { exercises } from './schema';
import type { Db } from './types';
import { count } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

export async function seedExercises(db: Db): Promise<void> {
  try {
    // Check if exercises table already has records
    const [row] = await db.select({ value: count() }).from(exercises);
    if (row && row.value > 0) {
      console.log('Exercises already seeded, skipping.');
      return;
    }

    // Seed data lives in-repo so tests and fresh clones can seed without extra setup.
    const jsonPath = path.resolve(process.cwd(), 'src/db/seed-data/spine-conditioning-program.json');
    if (!fs.existsSync(jsonPath)) {
      console.warn(`Seed JSON file not found at: ${jsonPath}`);
      return;
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

    console.log(`Seeding ${data.exercises.length} exercises from JSON...`);
    
    // Insert exercises
    for (const item of data.exercises) {
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
        imagePath: item.category === 'neck' ? '/images/exercises/neck-stretch.png' : null,
      });
    }

    console.log('Exercises seeded successfully.');
  } catch (error) {
    console.error('Failed to seed exercises:', error);
  }
}
