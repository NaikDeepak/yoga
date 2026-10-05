import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { getSharedExerciseProgramme } from '@/data/exercises';
import { getSharedPostureReport } from '@/data/shared-posture';
import { recordShareView, resolveAnyShareLink } from '@/data/share-links';
import { CLINIC } from '@/lib/clinic';
import { isLinkPreviewBot } from '@/lib/share-token';
import { getStorage } from '@/lib/storage';
import { getTranslations } from '@/lib/i18n/translations';
import { ExercisesBody } from './ExercisesBody';
import { PostureReportBody } from './PostureReportBody';

// Public, token-checked page. Each kind of link gets only its whitelisted view model
// (SharedExerciseProgramme / SharedPostureReport), never database rows.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: "Pawar's Yog Therapy",
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function SharedLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string; edit?: string; error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const lang = query.lang === 'mr' ? 'mr' : 'en';
  const now = new Date();
  const db = getDb();
  const link = await resolveAnyShareLink(db, token, now);
  if (!link) notFound(); // unknown, expired and revoked all look the same

  const tr = getTranslations(lang);
  const t = tr.sharedPage;
  let body: React.ReactNode;
  if (link.kind === 'posture') {
    const report = await getSharedPostureReport(db, getStorage(), link);
    if (!report) notFound();
    body = <PostureReportBody report={report} t={tr} />;
  } else {
    const programme = await getSharedExerciseProgramme(db, token, lang, now);
    if (!programme) notFound();
    body = (
      <ExercisesBody token={token} lang={lang} programme={programme}
        editing={query.edit === '1'} error={query.error === '1'} t={t} />
    );
  }

  // Best-effort: a failed counter must not stop the client seeing the page. WhatsApp etc. fetch
  // the link to build a preview when the physio sends it; that isn't the client opening it.
  if (!isLinkPreviewBot((await headers()).get('user-agent'))) {
    await recordShareView(db, link.id, now).catch(() => {});
  }

  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 py-6" lang={lang}>
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <img src="/pytc-logo.png" alt="" className="h-10 w-10" referrerPolicy="no-referrer" />
          <span className="text-sm font-semibold">{CLINIC.name}</span>
        </div>
        <nav className="flex rounded-full border text-xs" aria-label="Language">
          <a href="?lang=en" className={`rounded-full px-3 py-1 ${lang === 'en' ? 'bg-primary text-primary-foreground' : ''}`}>EN</a>
          <a href="?lang=mr" className={`rounded-full px-3 py-1 ${lang === 'mr' ? 'bg-primary text-primary-foreground' : ''}`}>मराठी</a>
        </nav>
      </header>

      {body}

      <footer className="space-y-2 rounded-2xl bg-muted p-4 text-sm">
        <p>⚠️ {link.kind === 'posture' ? t.postureFooter : t.safety}</p>
        <a href={`tel:${CLINIC.phone.replace(/\s/g, '')}`} className="font-medium text-primary">{t.call}: {CLINIC.phone}</a>
      </footer>
    </main>
  );
}
