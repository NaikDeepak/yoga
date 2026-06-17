'use client';

import { createContext, useContext } from 'react';
import { en } from './en';
import type { Translations } from './en';
import type { Locale } from './translations';
import { getTranslations } from './translations';

const LocaleContext = createContext<Translations>(en);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={getTranslations(locale)}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useTranslations(): Translations {
  return useContext(LocaleContext);
}
