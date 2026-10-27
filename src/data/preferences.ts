import { eq } from 'drizzle-orm';
import { userPreferences } from '@/db/schema';
import type { Db } from '@/db/types';
import { getISTDateString } from '@/lib/dates';

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
      set: { language: locale, updatedAt: new Date(getISTDateString()) },
    });
}

export async function getWhatsappNumber(db: Db, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ whatsappNumber: userPreferences.whatsappNumber })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));
  return row?.whatsappNumber ?? null;
}

export async function setWhatsappNumber(db: Db, userId: string, mobile: string | null): Promise<void> {
  await db
    .insert(userPreferences)
    .values({ userId, whatsappNumber: mobile })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { whatsappNumber: mobile, updatedAt: new Date(getISTDateString()) },
    });
}

/**
 * Moves one login's preference row (language, WhatsApp number) to another user id, e.g. when a
 * clinic's staff get new login ids on a new login provider. One transaction; refuses rather than
 * merging or overwriting. Returns the number of rows moved (always 1).
 */
export async function moveUserPreferences(db: Db, fromUserId: string, toUserId: string): Promise<number> {
  if (fromUserId === toUserId) throw new Error('--from and --to must differ');
  return db.transaction(async (tx) => {
    const hasRow = async (userId: string) =>
      (await tx.select({ userId: userPreferences.userId }).from(userPreferences).where(eq(userPreferences.userId, userId))).length > 0;
    if (!(await hasRow(fromUserId))) throw new Error('--from has no preferences row');
    if (await hasRow(toUserId)) throw new Error('--to already has a preferences row; not overwriting it');
    const moved = await tx
      .update(userPreferences)
      .set({ userId: toUserId, updatedAt: new Date() })
      .where(eq(userPreferences.userId, fromUserId))
      .returning({ userId: userPreferences.userId });
    return moved.length;
  });
}
