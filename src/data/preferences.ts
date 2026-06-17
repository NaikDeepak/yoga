import { eq } from 'drizzle-orm';
import { userPreferences } from '@/db/schema';
import type { Db } from '@/db/types';

type Locale = 'en' | 'mr';

export async function getUserLanguage(db: Db, userId: string): Promise<Locale> {
  const [row] = await db
    .select({ language: userPreferences.language })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));
  if (!row) return 'en';
  return (row.language === 'mr' ? 'mr' : 'en') as Locale;
}

export async function setUserLanguage(db: Db, userId: string, locale: Locale): Promise<void> {
  await db
    .insert(userPreferences)
    .values({ userId, language: locale })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { language: locale, updatedAt: new Date() },
    });
}
