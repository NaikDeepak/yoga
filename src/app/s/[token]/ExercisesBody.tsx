import type { SharedExerciseProgramme } from '@/data/exercises';
import type { Translations } from '@/lib/i18n/en';
import { CheckinForm } from './CheckinForm';

/** Client's home-exercise programme with today's check-in (share link kind 'exercises'). */
export function ExercisesBody({ token, lang, programme, editing, error, t }: {
  token: string;
  lang: 'en' | 'mr';
  programme: SharedExerciseProgramme;
  editing: boolean;
  error: boolean;
  t: Translations['sharedPage'];
}) {
  return (
    <>
      <section>
        <h1 className="text-2xl font-bold">{t.greeting.replace('{name}', programme.firstName)} 🙏</h1>
        <p className="text-muted-foreground">{t.intro}</p>
      </section>

      {programme.exercises.length > 0 && (
        <CheckinForm
          token={token} lang={lang} checkins={programme.checkins}
          editing={editing} error={error} t={t.checkin}
        />
      )}

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

    </>
  );
}
