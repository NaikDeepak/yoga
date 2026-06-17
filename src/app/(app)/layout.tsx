import { requireUser } from '@/lib/auth';
import { getDb } from '@/db/client';
import { countPatients } from '@/data/patients';
import { getUserLanguage } from '@/data/preferences';
import { AppShell } from '@/components/AppShell';
import type { Locale } from '@/lib/i18n/translations';
import { cookies } from 'next/headers';
import { LOCALES } from '@/lib/i18n/translations';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, patientCount] = await Promise.all([
    requireUser(),
    countPatients(getDb()),
  ]);

  // Resolve locale: cookie is authoritative (set by saveLanguageAction).
  // On first load on a new device, the cookie is absent — fall back to DB preference.
  const cookieStore = await cookies();
  const langCookie = cookieStore.get('lang')?.value;
  const locale: Locale = (LOCALES as readonly string[]).includes(langCookie ?? '')
    ? (langCookie as Locale)
    : await getUserLanguage(getDb(), user.id);

  return (
    <AppShell userEmail={user.email ?? null} patientCount={patientCount} locale={locale}>
      {children}
    </AppShell>
  );
}
