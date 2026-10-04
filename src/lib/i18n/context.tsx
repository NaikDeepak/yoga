'use client';

import { createContext, useContext } from 'react';
import { en } from './en';
import type { Translations } from './en';
import type { Locale } from './translations';
import { getTranslations } from './translations';

const LocaleContext = createContext<Translations>(en);
const LocaleNameContext = createContext<Locale>('en');

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleNameContext.Provider value={locale}>
      <LocaleContext.Provider value={getTranslations(locale)}>
        {children}
      </LocaleContext.Provider>
    </LocaleNameContext.Provider>
  );
}

export function useTranslations(): Translations {
  return useContext(LocaleContext);
}

/** The active locale code ('en' | 'mr'), e.g. to pick a speech voice. */
export function useLocale(): Locale {
  return useContext(LocaleNameContext);
}
