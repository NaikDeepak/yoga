import { cookies } from 'next/headers';
import { LOCALES, type Locale } from './translations';
import { createSupabaseServerClient } from '../supabase/server';
import { getDb } from '@/db/client';
import { getUserLanguage } from '@/data/preferences';

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const lang = cookieStore.get('lang')?.value;
  if ((LOCALES as readonly string[]).includes(lang ?? '')) {
    return lang as Locale;
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      return await getUserLanguage(getDb(), user.id);
    }
  } catch {
    // Ignore errors if not logged in
  }
  return 'en';
}
