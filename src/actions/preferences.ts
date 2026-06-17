'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/db/client';
import { setUserLanguage } from '@/data/preferences';
import { LOCALES, type Locale } from '@/lib/i18n/translations';
import type { ActionResult } from '@/actions/patients';

export async function saveLanguageAction(locale: Locale): Promise<ActionResult> {
  if (!(LOCALES as readonly string[]).includes(locale)) {
    return { ok: false, error: 'Invalid language / अमान्य भाषा' };
  }
  const user = await requireUser();
  await setUserLanguage(getDb(), user.id, locale);
  const cookieStore = await cookies();
  cookieStore.set('lang', locale, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}
