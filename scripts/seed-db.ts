import { getDb } from '../src/db/client';
import { seedExercises } from '../src/db/seed-exercises';

// Ensure env variables are loaded if running outside Next.js
import fs from 'fs';
import path from 'path';

if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of envLines) {
      const match = line.match(/^\s*DATABASE_URL\s*=\s*(.+)$/);
      if (match) {
        process.env.DATABASE_URL = match[1].trim().replace(/^['"]|['"]$/g, '');
        break;
      }
    }
  }
}

async function main() {
  const db = getDb();
  await seedExercises(db);
  console.log('Local DB seeding complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Local DB seeding failed:', err);
  process.exit(1);
});
