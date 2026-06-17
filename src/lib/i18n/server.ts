import { cookies } from 'next/headers';
import { LOCALES, type Locale } from './translations';

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const lang = cookieStore.get('lang')?.value;
  return (LOCALES as readonly string[]).includes(lang ?? '') ? (lang as Locale) : 'en';
}
