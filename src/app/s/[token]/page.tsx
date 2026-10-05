import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { getSharedExerciseProgramme } from '@/data/exercises';
import { recordShareView } from '@/data/share-links';
import { CLINIC } from '@/lib/clinic';
import { getTranslations } from '@/lib/i18n/translations';

// Public, token-checked page: it only ever receives the whitelisted SharedExerciseProgramme.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: "Home exercises · Pawar's Yog Therapy",
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function SharedExercisesPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const lang = (await searchParams).lang === 'mr' ? 'mr' : 'en';
  const now = new Date();
  const db = getDb();
  const programme = await getSharedExerciseProgramme(db, token, lang, now);
  if (!programme) notFound(); // unknown, expired and revoked all look the same

  // Best-effort: a failed counter must not stop the client seeing their exercises.
  await recordShareView(db, programme.linkId, now).catch(() => {});

  const t = getTranslations(lang).sharedPage;
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

      <section>
        <h1 className="text-2xl font-bold">{t.greeting.replace('{name}', programme.firstName)} 🙏</h1>
        <p className="text-muted-foreground">{t.intro}</p>
      </section>

      {programme.exercises.length === 0 ? (
        <p className="rounded-2xl border bg-card p-5 text-muted-foreground">{t.empty}</p>
      ) : (
        <ol className="space-y-4">
          {programme.exercises.map((ex, i) => (
            <li key={`${ex.name}-${i}`} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              {ex.imagePath && (
                <img src={ex.imagePath} alt={ex.name} className="w-full bg-muted object-contain" loading="lazy" referrerPolicy="no-referrer" />
              )}
              <div className="space-y-3 p-4">
                <h2 className="text-lg font-semibold">{i + 1}. {ex.name}</h2>
                {ex.description && <p className="text-sm text-muted-foreground">{ex.description}</p>}
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-primary/10 p-2"><dt className="text-xs text-muted-foreground">{t.reps}</dt><dd className="font-medium">{ex.repetitions}</dd></div>
                  <div className="rounded-lg bg-primary/10 p-2"><dt className="text-xs text-muted-foreground">{t.days}</dt><dd className="font-medium">{ex.daysPerWeek}</dd></div>
                </dl>
                {ex.note && (
                  <p className="rounded-lg border border-yellow-300 bg-yellow-50 p-2 text-sm"><strong>{t.note}:</strong> {ex.note}</p>
                )}
                {ex.steps.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold">{t.steps}</h3>
                    <ol className="ml-5 list-decimal space-y-1 text-sm">{ex.steps.map((s, j) => <li key={j}>{s}</li>)}</ol>
                  </div>
                )}
                {ex.tip && <p className="text-sm"><strong>{t.tip}:</strong> {ex.tip}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}

      <footer className="space-y-2 rounded-2xl bg-muted p-4 text-sm">
        <p>⚠️ {t.safety}</p>
        <a href={`tel:${CLINIC.phone.replace(/\s/g, '')}`} className="font-medium text-primary">{t.call}: {CLINIC.phone}</a>
      </footer>
    </main>
  );
}
