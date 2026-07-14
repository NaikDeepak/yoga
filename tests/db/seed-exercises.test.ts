import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { count, eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { createTestDb } from '../helpers/db';
import { seedExercises } from '@/db/seed-exercises';
import { exercises } from '@/db/schema';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => {
  // createTestDb already runs seedExercises once, so every test starts seeded.
  db = await createTestDb();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function exerciseCount() {
  const [{ n }] = await db.select({ n: count() }).from(exercises);
  return Number(n);
}

describe('seedExercises', () => {
  it('is idempotent — a second run adds no rows and no duplicate names', async () => {
    const before = await exerciseCount();
    await seedExercises(db);
    expect(await exerciseCount()).toBe(before);

    const names = (await db.select({ name: exercises.name }).from(exercises)).map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('syncs drifted fields back to the seed JSON values on re-run', async () => {
    await db
      .update(exercises)
      .set({ repetitions: 'drifted', category: 'wrong' })
      .where(eq(exercises.name, 'Plank'));

    await seedExercises(db);

    const seedJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'src/db/seed-data/spine-conditioning-program.json'), 'utf-8'),
    ) as { exercises: Array<{ name: string; repetitions: string; category: string }> };
    const plankSeed = seedJson.exercises.find((e) => e.name === 'Plank');
    expect(plankSeed).toBeDefined();

    const [plank] = await db.select().from(exercises).where(eq(exercises.name, 'Plank'));
    expect(plank.repetitions).toBe(plankSeed!.repetitions);
    expect(plank.category).toBe(plankSeed!.category);
  });

  it('preserves an existing image_path when the exercise is missing from the image map', async () => {
    const [before] = await db.select().from(exercises).where(eq(exercises.name, 'Plank'));
    expect(before.imagePath).not.toBeNull();

    await seedExercises(db, { imageMap: {} });

    const [after] = await db.select().from(exercises).where(eq(exercises.name, 'Plank'));
    expect(after.imagePath).toBe(before.imagePath);
  });

  it('warns about DB exercises missing from the seed JSON (rename leaves an orphan)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await db.insert(exercises).values({
      name: 'Old Renamed Exercise',
      nameMr: 'जुना व्यायाम',
      category: 'back',
      repetitions: '5',
      repetitionsMr: '५',
      daysPerWeek: '3',
      daysPerWeekMr: '३',
      steps: ['step'],
      stepsMr: ['पायरी'],
    });

    await seedExercises(db);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Old Renamed Exercise'));
  });
});
