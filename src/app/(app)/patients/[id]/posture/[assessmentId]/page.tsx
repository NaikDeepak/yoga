import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { getPostureAssessment } from '@/data/posture';
import { listAllExercises } from '@/data/exercises';
import { deletePostureAssessmentAction } from '@/actions/posture';
import { getStorage } from '@/lib/storage';
import { BRANCHES } from '@/lib/presets';
import { buildOverlay } from '@/lib/posture-overlay';
import { formatMetric } from '@/lib/posture-format';
import { scorePosture, detectPatterns, focusCategories, REGIONS } from '@/lib/posture-insights';
import type { Metric, PostureView } from '@/lib/posture';
import { formatFullDate, getISTDateString } from '@/lib/dates';
import { getLocale } from '@/lib/i18n/server';
import { getTranslations } from '@/lib/i18n/translations';
import { ReportLetterhead } from '@/components/ReportLetterhead';
import { PrintButton } from '@/components/PrintButton';
import { DeleteButton } from '@/components/DeleteButton';
import { Button } from '@/components/ui/button';
import { PostureFigure } from '@/components/posture/PostureFigure';
import { PostureFindings } from '@/components/posture/PostureFindings';
import {
  BRAND, PatternCard, RegionBars, ScoreRing, SectionHeader, SeverityDot,
} from '@/components/posture/ReportParts';

const EXERCISES_PER_CATEGORY = 3;

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

  const score = scorePosture(views);
  const patterns = detectPatterns(views);
  const focus = focusCategories(patterns);
  const library = focus.length ? await listAllExercises(db) : [];
  const exercisesFor = (category: string) =>
    library.filter((e) => e.category === category).slice(0, EXERCISES_PER_CATEGORY);

  const evidenceText = (view: PostureView, metric: Metric) => {
    const f = formatMetric(metric, p);
    return [ins.viewNames[view], f.value, f.detail].filter(Boolean).join(' · ');
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
            redirectTo={`/patients/${id}?tab=assessment`}
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
        </div>
      </section>

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
                  evidence={pt.evidence.map((e) => evidenceText(e.view, e.metric))}
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
