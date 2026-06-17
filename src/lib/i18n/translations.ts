import { en } from './en';
import { mr } from './mr';
import type { Translations } from './en';

export { type Translations };
export const LOCALES = ['en', 'mr'] as const;
export type Locale = typeof LOCALES[number];

const localeMap: Record<Locale, Translations> = { en, mr };

export function getTranslations(locale: Locale): Translations {
  return localeMap[locale];
}
