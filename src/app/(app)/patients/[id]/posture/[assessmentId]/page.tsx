import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { getPostureAssessment } from '@/data/posture';
import { deletePostureAssessmentAction } from '@/actions/posture';
import { getStorage } from '@/lib/storage';
import { BRANCHES } from '@/lib/presets';
import { buildOverlay } from '@/lib/posture-overlay';
import { formatMetric, summarizeFindings } from '@/lib/posture-format';
import type { PostureView } from '@/lib/posture';
import { formatFullDate, getISTDateString } from '@/lib/dates';
import { getLocale } from '@/lib/i18n/server';
import { getTranslations } from '@/lib/i18n/translations';
import { ReportLetterhead } from '@/components/ReportLetterhead';
import { PrintButton } from '@/components/PrintButton';
import { DeleteButton } from '@/components/DeleteButton';
import { Button } from '@/components/ui/button';
import { PostureFigure } from '@/components/posture/PostureFigure';
import { PostureFindings, SeverityChip } from '@/components/posture/PostureFindings';

const SAFFRON = '#C8962E';

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

  const t = getTranslations(await getLocale());
  const p = t.posture;
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
  const summary = summarizeFindings(views);

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
      <table className="mb-6 w-full border-collapse text-sm">
        <tbody>
          <tr className="border-b border-gray-100">
            <td className="w-32 py-2 font-medium text-gray-700">{t.form.fullName}</td>
            <td className="py-2 pr-6">{patient.fullName}</td>
            <td className="w-32 py-2 font-medium text-gray-700">{p.assessedOn}</td>
            <td className="py-2">{formatFullDate(assessment.assessedOn)}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="w-32 py-2 font-medium text-gray-700">{t.receipt.patientCode}</td>
            <td className="py-2 pr-6">{patient.patientCode}</td>
            <td className="w-32 py-2 font-medium text-gray-700">{p.heightUsed}</td>
            <td className="py-2">{assessment.heightCm ? `${assessment.heightCm} cm` : p.heightUnknown}</td>
          </tr>
        </tbody>
      </table>

      {/* ── SUMMARY ── */}
      <SectionHeader>{p.summary}</SectionHeader>
      <div className="mb-8 rounded border p-4 print:break-inside-avoid" style={{ borderColor: '#E5D5B5' }}>
        <div className="mb-3 flex flex-wrap gap-2">
          <SeverityChip severity="marked" label={p.markedCount.replace('{count}', String(summary.marked))} />
          <SeverityChip severity="mild" label={p.mildCount.replace('{count}', String(summary.mild))} />
        </div>
        {summary.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{p.noFindings}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {summary.items.map(({ view, metric }, i) => {
              const f = formatMetric(metric, p);
              return (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                  <SeverityChip severity={f.severity} label={f.status} />
                  <span className="font-medium">{f.label}</span>
                  <span className="tabular-nums">{f.value}</span>
                  {f.detail && <span className="text-muted-foreground">{f.detail}</span>}
                  <span className="text-xs text-muted-foreground">· {p.views[view]}</span>
                </li>
              );
            })}
          </ul>
        )}
        {assessment.note && (
          <p className="mt-3 border-t pt-3 text-sm"><span className="font-medium">{p.note}:</span> {assessment.note}</p>
        )}
      </div>

      {/* ── VIEWS ── */}
      <SectionHeader>{p.findings}</SectionHeader>
      <div className="space-y-8">
        {views.map((v) => (
          <section key={v.view} className="grid gap-4 md:grid-cols-[300px_minmax(0,1fr)] print:break-inside-avoid">
            <div className="mx-auto w-full max-w-[300px]">
              <h3 className="mb-2 text-sm font-semibold">{p.views[v.view]}</h3>
              <PostureFigure overlay={v.overlay} photoUrl={v.photoUrl} metrics={v.metrics} alt={p.views[v.view]} noPhotoLabel={p.noPhoto} />
              {v.cameraCheck && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {v.cameraCheck.method === 'sensor' ? p.capture.cameraLevelSensor : p.capture.cameraLevelReference}
                  {' · '}
                  {v.cameraCheck.pitchDeg === null
                    ? p.capture.rollOnly.replace('{roll}', v.cameraCheck.rollDeg.toFixed(1))
                    : p.capture.sensorReading
                      .replace('{roll}', v.cameraCheck.rollDeg.toFixed(1))
                      .replace('{pitch}', v.cameraCheck.pitchDeg.toFixed(1))}
                </p>
              )}
              {v.edited && <p className="mt-1 text-xs text-muted-foreground">{p.edited}</p>}
            </div>
            <div className="overflow-x-auto md:pt-7">
              <PostureFindings metrics={v.metrics} t={p} />
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 border-t pt-4 text-xs italic text-gray-500">{p.disclaimer}</p>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 border-l-4 pl-3" style={{ borderColor: SAFFRON }}>
      <span className="text-xs font-bold uppercase tracking-widest text-gray-600">{children}</span>
    </div>
  );
}
