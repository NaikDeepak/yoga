import Link from 'next/link';
import { Activity } from 'lucide-react';
import type { Flexibility } from '@/data/flexibility';
import type { Translations } from '@/lib/i18n/en';
import { shotOverlay } from '@/lib/capture-shots';
import { FLEX_TESTS, type FlexResult, type FlexShot, type FlexTest } from '@/lib/flexibility';
import { Button } from '@/components/ui/button';
import { PostureFigure } from './PostureFigure';
import { IdealFigure } from './IdealFigure';
import { BRAND, FLEX_BAND_COLOR, SectionHeader } from './ReportParts';

/** The ideal pose beside a test: one shoulder side is enough — the right, unless only the left was captured. */
const idealShotFor = (test: FlexTest, taken: FlexShot[]): FlexShot =>
  test !== 'shoulderExtension' ? test : taken.includes('shoulderExtRight') ? 'shoulderExtRight' : 'shoulderExtLeft';
const SHOTS_OF: Record<FlexTest, FlexShot[]> = {
  shoulderExtension: ['shoulderExtLeft', 'shoulderExtRight'],
  forwardFold: ['forwardFold'],
  butterfly: ['butterfly'],
};

/**
 * Flexibility part of the posture report (spec 2026-10-06-flexibility-tests): one card per test with
 * photo + figure, 0–100 score and band, the measured values and any quality flags. `photoUrls` are
 * signed by the page; a missing one shows the deleted / unavailable label.
 */
export function FlexibilitySection({
  flexibility, photoUrls, captureHref, t,
}: {
  flexibility: Flexibility;
  photoUrls: Partial<Record<FlexShot, string | null>>;
  /** Link to the capture screen (all shots); null hides the buttons (e.g. posture switched off). */
  captureHref: string | null;
  t: Translations;
}) {
  const f = t.posture.flex;
  const taken = new Set(flexibility.shots.map((s) => s.shot));

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeader>{f.title}</SectionHeader>
        {captureHref && (
          <Button asChild size="sm" variant="outline" className="print:hidden">
            <Link href={captureHref}><Activity className="mr-1.5 h-4 w-4" aria-hidden="true" />{taken.size ? f.retake : f.add}</Link>
          </Button>
        )}
      </div>
      {!taken.size ? (
        <p className="text-sm text-muted-foreground">{f.empty}</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-gray-500">{f.bandScale}</p>
          <div className="grid gap-4 md:grid-cols-3">
            {FLEX_TESTS.map((test) => (
              <TestCard key={test} test={test} result={flexibility.scores[test]} flexibility={flexibility} photoUrls={photoUrls} t={t} />
            ))}
          </div>
          <p className="mt-2 text-xs italic text-gray-500">{f.scoringNote}</p>
        </>
      )}
    </section>
  );
}

function TestCard({
  test, result, flexibility, photoUrls, t,
}: {
  test: FlexTest;
  result: FlexResult | null;
  flexibility: Flexibility;
  photoUrls: Partial<Record<FlexShot, string | null>>;
  t: Translations;
}) {
  const f = t.posture.flex;
  const shots = flexibility.shots.filter((s) => SHOTS_OF[test].includes(s.shot));
  const n = (x: number | null | undefined) => (x == null ? '—' : String(x));

  const details: string[] = [];
  if (test === 'shoulderExtension') {
    for (const s of shots) {
      const deg = s.measure.shoulderExtensionDeg;
      details.push(`${f.shots[s.shot]}: ${deg == null ? f.notMeasured : f.extension.replace('{deg}', String(deg))}`);
    }
    if (result?.sides) details.push(f.sides.replace('{left}', n(result.sides.left)).replace('{right}', n(result.sides.right)));
  } else if (test === 'forwardFold' && shots[0]) {
    const m = shots[0].measure;
    if (m.hipAngleDeg != null) details.push(f.hipAngle.replace('{deg}', String(m.hipAngleDeg)));
    if (m.reach) details.push(f.reach[m.reach]);
  } else if (test === 'butterfly' && result?.sides) {
    details.push(f.knees.replace('{left}', n(result.sides.left)).replace('{right}', n(result.sides.right)));
  }

  return (
    <article className="rounded-xl border p-3 print:break-inside-avoid" style={{ borderColor: BRAND.sand }}>
      <h3 className="text-sm font-semibold" style={{ color: BRAND.green }}>{f.tests[test]}</h3>
      {/* The client's shot(s), then the ideal pose for the test (score 100). */}
      <div className={`mt-2 grid items-start gap-2 ${shots.length > 1 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {shots.map((s) => (
          <PostureFigure
            key={s.shot}
            overlay={shotOverlay(s.shot, s.landmarks, s.imageWidth, s.imageHeight)}
            photoUrl={photoUrls[s.shot] ?? null}
            metrics={[]}
            alt={f.shots[s.shot]}
            noPhotoLabel={s.filePath === null ? t.posture.photoDeleted : t.posture.noPhoto}
          />
        ))}
        {shots.length > 0 && <IdealFigure shot={idealShotFor(test, shots.map((s) => s.shot))} label={t.posture.ideal} />}
      </div>
      {result && result.score !== null && result.band ? (
        <p className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums" style={{ color: FLEX_BAND_COLOR[result.band] }}>{result.score}</span>
          <span className="text-xs text-gray-500">{f.outOf}</span>
          <span className="text-sm font-medium" style={{ color: FLEX_BAND_COLOR[result.band] }}>{f.bands[result.band]}</span>
        </p>
      ) : (
        <p className="mt-3 text-sm text-gray-500">{f.notMeasured}</p>
      )}
      {details.length > 0 && <ul className="mt-1 space-y-0.5 text-xs text-gray-700">{details.map((d) => <li key={d}>{d}</li>)}</ul>}
      {result?.flags.map((flag) => <p key={flag} className="mt-1 text-xs text-amber-700">{f.flags[flag]}</p>)}
    </article>
  );
}
