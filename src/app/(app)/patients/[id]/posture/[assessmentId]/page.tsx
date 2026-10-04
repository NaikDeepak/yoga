import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Camera } from 'lucide-react';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { getPostureAssessment } from '@/data/posture';
import { listAllExercises } from '@/data/exercises';
import { deletePostureAssessmentAction } from '@/actions/posture';
import { getStorage } from '@/lib/storage';
import { BRANCHES } from '@/lib/presets';
import { buildOverlay } from '@/lib/posture-overlay';
import { formatMetric } from '@/lib/posture-format';
import {
  combineViews, scorePosture, detectPatterns, focusCategories, REGIONS, type CombinedMetric,
} from '@/lib/posture-insights';
import { POSTURE_VIEWS, type PostureView } from '@/lib/posture';
import { formatFullDate, getISTDateString } from '@/lib/dates';
import { getLocale } from '@/lib/i18n/server';
import { getTranslations } from '@/lib/i18n/translations';
import { ReportLetterhead } from '@/components/ReportLetterhead';
import { PrintButton } from '@/components/PrintButton';
import { DeleteButton } from '@/components/DeleteButton';
import { Button } from '@/components/ui/button';
import { PostureFigure } from '@/components/posture/PostureFigure';
import { PostureFindings } from '@/components/posture/PostureFindings';
import { PostureAiPanel } from '@/components/posture/PostureAiPanel';
import {
  BRAND, PatternCard, RegionBars, ScoreRing, SectionHeader, SeverityDot,
} from '@/components/posture/ReportParts';

const EXERCISES_PER_CATEGORY = 3;

// The AI analysis action (up to ~30 s for Gemini) runs in this route's function on Vercel.
export const maxDuration = 60;

export default async function PostureReportPage({
  params,
}: {
  params: Promise<{ id: string; assessmentId: string }>;
}) {
  const { id, assessmentId } = await params;
  const db = getDb();
  const patient = await getPatient(db, id);
  if (!patient) notFound();
  const assessment = await getPostureAssessment(db, assessmentId);
  if (!assessment || assessment.patientId !== id) notFound();

  const locale = await getLocale();
  const t = getTranslations(locale);
  const p = t.posture;
  const ins = p.insights;
  const branch = BRANCHES.find((b) => b.key === patient.branch) ?? null;
  const storage = getStorage();

  const views = await Promise.all(assessment.views.map(async (v) => ({
    view: v.view as PostureView,
    metrics: v.metrics,
    edited: v.landmarksEdited,
    cameraCheck: v.cameraCheck,
    overlay: buildOverlay(v.view as PostureView, v.landmarks, v.imageWidth, v.imageHeight),
    photoUrl: await storage.createSignedUrl(v.filePath).catch(() => null),
  })));

  // Front/back and left/right readings of the same measure are averaged for scoring and patterns.
  const combined = combineViews(views);
  const score = scorePosture(combined);
  const patterns = detectPatterns(combined);
  const disagreements = combined.filter((m) => m.lowConfidence);
  const retakeViews = POSTURE_VIEWS.filter((v) => disagreements.some((m) => m.sources.some((s) => s.view === v)));
  const retakeHref = (vs: readonly PostureView[]) => `/patients/${id}/posture/${assessmentId}/retake?views=${vs.join(',')}`;
  const focus = focusCategories(patterns);
  const library = focus.length ? await listAllExercises(db) : [];
  const exercisesFor = (category: string) =>
    library.filter((e) => e.category === category).slice(0, EXERCISES_PER_CATEGORY);

  const reading = (view: PostureView, value: string) => `${ins.viewNames[view]} ${value}`;
  const evidenceText = (m: CombinedMetric) => {
    const f = formatMetric(m, p);
    const perView = m.sources.map((s) => reading(s.view, formatMetric(s.metric, p).value)).join(' · ');
    return [f.value, f.detail, m.sources.length > 1 ? `(${perView})` : perView, m.lowConfidence ? ins.lowConfidence : '']
      .filter(Boolean).join(' · ');
  };
  const headline = patterns.map((pt) => ins.patterns[pt.key].title).join(' · ');

  return (
    <div className="mx-auto max-w-5xl bg-white p-4 sm:p-8 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/patients/${id}?tab=assessment`}>
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
            {p.back}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <DeleteButton
            action={deletePostureAssessmentAction.bind(null, id, assessmentId)}
            confirmText={p.deleteConfirm}
          />
          <PrintButton />
        </div>
      </div>

      <ReportLetterhead badgeLabel={p.reportTitle} patientCode={patient.patientCode} branch={branch} today={getISTDateString()} />

      {/* ── CLIENT ── */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-b pb-4 text-sm sm:grid-cols-4" style={{ borderColor: BRAND.sand }}>
        <div><dt className="text-gray-500">{t.form.fullName}</dt><dd className="font-medium">{patient.fullName}</dd></div>
        <div><dt className="text-gray-500">{t.receipt.patientCode}</dt><dd className="font-medium">{patient.patientCode}</dd></div>
        <div><dt className="text-gray-500">{p.assessedOn}</dt><dd className="font-medium">{formatFullDate(assessment.assessedOn)}</dd></div>
        <div><dt className="text-gray-500">{p.heightUsed}</dt><dd className="font-medium">{assessment.heightCm ? `${assessment.heightCm} cm` : p.heightUnknown}</dd></div>
      </dl>

      {/* ── SCORE ── */}
      <section className="mt-6 grid items-center gap-6 rounded-xl p-5 sm:grid-cols-[auto_1fr] print:break-inside-avoid" style={{ backgroundColor: BRAND.sandLight }}>
        <div className="flex flex-col items-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-600">{ins.scoreTitle}</p>
          {score.overall !== null && score.grade !== null
            ? <ScoreRing score={score.overall} grade={score.grade} gradeLabel={ins.grades[score.grade]} outOf={ins.scoreOutOf} />
            : <p className="text-sm text-muted-foreground">{ins.notMeasured}</p>}
        </div>
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-600">{ins.regionsTitle}</p>
          <RegionBars rows={REGIONS.map((r) => ({ label: ins.regions[r], region: score.regions[r] }))} notMeasured={ins.notMeasured} />
          <p className="mt-3 text-[11px] text-gray-500">{ins.averaged}</p>
        </div>
      </section>

      {/* ── AI ANALYSIS ── (hidden in print until one exists) */}
      <div className={assessment.aiReport ? '' : 'print:hidden'}>
        <SectionHeader>{p.ai.title}</SectionHeader>
        <PostureAiPanel
          patientId={id}
          assessmentId={assessmentId}
          report={assessment.aiReport ?? null}
          approvedAt={assessment.aiApprovedAt ? assessment.aiApprovedAt.toISOString().slice(0, 10) : null}
        />
      </div>

      {/* ── PATTERN ── */}
      <SectionHeader>{ins.overallPattern}</SectionHeader>
      {patterns.length === 0 ? (
        <p className="text-sm text-gray-700">{ins.noPatterns}</p>
      ) : (
        <>
          <p className="mb-4 text-lg font-semibold" style={{ color: BRAND.green }}>{headline}</p>
          <div className="space-y-3">
            {patterns.map((pt) => {
              const text = ins.patterns[pt.key];
              return (
                <PatternCard
                  key={pt.key}
                  title={text.title}
                  severity={pt.severity}
                  severityLabel={p.severity[pt.severity]}
                  summary={text.summary}
                  evidence={pt.evidence.map(evidenceText)}
                  causesTitle={ins.likelyCauses}
                  causes={text.causes}
                  effectsTitle={ins.longTermEffects}
                  effects={text.effects}
                />
              );
            })}
          </div>
        </>
      )}
      {/* ── CONFIDENCE ── */}
      {disagreements.length > 0 && (
        <>
          <SectionHeader>{ins.confidenceTitle}</SectionHeader>
          <div className="rounded-lg border p-4 print:break-inside-avoid" style={{ borderColor: BRAND.saffron, backgroundColor: BRAND.sandLight }}>
            <ul className="list-disc space-y-1 pl-4 text-sm text-gray-700">
              {disagreements.map((m) => {
                const [a, b] = m.sources;
                return (
                  <li key={`${m.key}-${m.side ?? ''}`}>
                    {ins.disagree
                      .replace('{measure}', `${p.metrics[m.key]}${m.side && (m.key === 'kneeAlignment' || m.key === 'hindfoot') ? ` (${p.sides[m.side]})` : ''}`)
                      .replace('{a}', reading(a.view, formatMetric(a.metric, p).value))
                      .replace('{b}', reading(b.view, formatMetric(b.metric, p).value))
                      .replace('{avg}', formatMetric(m, p).value)}
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 print:hidden">
              <Button asChild size="sm" variant="outline">
                <Link href={retakeHref(retakeViews)}>
                  <Camera className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  {ins.retakeViews.replace('{views}', retakeViews.map((v) => ins.viewNames[v]).join(' & '))}
                </Link>
              </Button>
            </div>
          </div>
        </>
      )}

      {assessment.note && (
        <p className="mt-4 rounded-md border p-3 text-sm" style={{ borderColor: BRAND.sand }}>
          <span className="font-medium">{p.note}:</span> {assessment.note}
        </p>
      )}

      {/* ── FOCUS ── */}
      {focus.length > 0 && (
        <>
          <SectionHeader>{ins.focusAreas}</SectionHeader>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
            {focus.map((cat) => (
              <div key={cat} className="rounded-lg border p-3 print:break-inside-avoid" style={{ borderColor: BRAND.sand }}>
                <p className="font-semibold" style={{ color: BRAND.green }}>{ins.categories[cat]}</p>
                {exercisesFor(cat).length > 0 && (
                  <>
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">{ins.suggestedExercises}</p>
                    <ul className="mt-1 list-disc pl-4 text-sm text-gray-700">
                      {exercisesFor(cat).map((e) => <li key={e.id}>{locale === 'mr' ? e.nameMr : e.name}</li>)}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── PHOTOS + FINDINGS BY VIEW ── */}
      <SectionHeader>{ins.viewFindings}</SectionHeader>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 print:grid-cols-4">
        {views.map((v) => (
          <figure key={v.view} className="print:break-inside-avoid">
            <PostureFigure overlay={v.overlay} photoUrl={v.photoUrl} metrics={v.metrics} alt={ins.viewNames[v.view]} noPhotoLabel={p.noPhoto} />
            <figcaption className="mt-2">
              <p className="text-center text-sm font-semibold" style={{ color: BRAND.green }}>{ins.viewNames[v.view]}</p>
              <ul className="mt-2 space-y-1 text-xs">
                {v.metrics.filter((m) => m.severity !== null).map((m, i) => {
                  const f = formatMetric(m, p);
                  return (
                    <li key={`${m.key}-${m.side ?? i}`} className="flex gap-1.5">
                      <SeverityDot severity={m.severity} />
                      <span>
                        <span className="text-gray-700">{f.label}</span>{' '}
                        <span className="tabular-nums font-medium">{f.value}</span>
                        {f.detail && <span className="text-gray-500"> · {f.detail}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {v.cameraCheck && (
                <p className="mt-2 text-[10px] text-gray-500">
                  {v.cameraCheck.method === 'sensor' ? p.capture.cameraLevelSensor : p.capture.cameraLevelReference}
                  {' · '}
                  {v.cameraCheck.pitchDeg === null
                    ? p.capture.rollOnly.replace('{roll}', v.cameraCheck.rollDeg.toFixed(1))
                    : p.capture.sensorReading
                      .replace('{roll}', v.cameraCheck.rollDeg.toFixed(1))
                      .replace('{pitch}', v.cameraCheck.pitchDeg.toFixed(1))}
                </p>
              )}
              {v.edited && <p className="text-[10px] text-gray-500">{p.edited}</p>}
              <Link href={retakeHref([v.view])} className="mt-1 inline-block text-[11px] font-medium underline print:hidden" style={{ color: BRAND.green }}>
                {ins.retakePhoto}
              </Link>
            </figcaption>
          </figure>
        ))}
      </div>

      {/* ── DETAIL ── */}
      <details className="mt-8 rounded-lg border p-4 print:hidden" style={{ borderColor: BRAND.sand }}>
        <summary className="cursor-pointer text-sm font-semibold" style={{ color: BRAND.green }}>{ins.detailedMeasurements}</summary>
        <div className="mt-4 space-y-6">
          {views.map((v) => (
            <div key={v.view} className="overflow-x-auto">
              <h3 className="mb-1 text-sm font-semibold">{ins.viewNames[v.view]}</h3>
              <PostureFindings metrics={v.metrics} t={p} />
            </div>
          ))}
        </div>
      </details>

      <p className="mt-8 border-t pt-4 text-xs italic text-gray-500">{p.disclaimer}</p>
    </div>
  );
}
