import { saveCheckinAction } from '@/actions/checkins';
import { CheckinDots } from '@/components/CheckinDots';
import { adherence } from '@/lib/adherence';
import type { SharedExerciseProgramme } from '@/data/exercises';
import type { Translations } from '@/lib/i18n/en';

const DONE = ['all', 'some', 'none'] as const;
const PAIN = Array.from({ length: 11 }, (_, i) => i);

/** Daily check-in on the client's page. A plain form (no client JS); the action redirects back here. */
export function CheckinForm({ token, lang, checkins, editing, error, t }: {
  token: string;
  lang: 'en' | 'mr';
  checkins: SharedExerciseProgramme['checkins'];
  editing: boolean;
  error: boolean;
  t: Translations['sharedPage']['checkin'];
}) {
  const { today, last7 } = checkins;
  const shownDay = last7[last7.length - 1].date; // the server's today when the page was rendered
  const logged = last7.flatMap((d) => (d.done ? [{ date: d.date, done: d.done }] : []));
  const practised = adherence(logged, shownDay, 7, null).score; // same weights as the physio's card; fixed 7-day window

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
      {today && !editing ? (
        <p className="text-sm">
          <strong>{t.saved}</strong> {t.done[today.done]}
          {today.pain !== null && ` · ${t.painValue.replace('{pain}', String(today.pain))}`}
          {' · '}
          <a href={`?lang=${lang}&edit=1`} className="font-medium text-primary underline">{t.change}</a>
        </p>
      ) : (
        <form action={saveCheckinAction.bind(null, token, lang)} className="space-y-3">
          {/* The day this form was shown; the server honours it only just after midnight. */}
          <input type="hidden" name="day" value={shownDay} />
          <fieldset>
            <legend className="mb-2 font-semibold">{t.question}</legend>
            <div className="grid grid-cols-3 gap-2">
              {DONE.map((d) => (
                <label key={d} className="cursor-pointer">
                  <input type="radio" name="done" value={d} required defaultChecked={today?.done === d} className="peer sr-only" />
                  <span className="block rounded-lg border p-2 text-center text-sm peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2">
                    {t.done[d]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm">{t.pain} <span className="text-muted-foreground">({t.painOptional})</span></legend>
            <div className="flex flex-wrap gap-1.5">
              {/* "–" = no answer; lets a client clear a pain score they saved earlier today */}
              <label className="cursor-pointer">
                <input type="radio" name="pain" value="" defaultChecked={!today || today.pain === null} className="peer sr-only" />
                <span className="flex h-9 w-9 items-center justify-center rounded-full border text-sm peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2"
                  aria-label={t.painNone} title={t.painNone}>–</span>
              </label>
              {PAIN.map((n) => (
                <label key={n} className="cursor-pointer">
                  <input type="radio" name="pain" value={n} defaultChecked={today?.pain === n} className="peer sr-only" />
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border text-sm tabular-nums peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2">
                    {n}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive">{t.error}</p>}
          <button type="submit" className="w-full rounded-full bg-primary py-2.5 font-medium text-primary-foreground">{t.save}</button>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
        <CheckinDots days={last7} labels={t.legend} />
        <span>{t.last7.replace('{count}', String(practised))}</span>
      </div>
    </section>
  );
}
