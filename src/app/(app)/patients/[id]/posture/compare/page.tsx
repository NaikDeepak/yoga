import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { getPostureAssessment, type PostureAssessment } from '@/data/posture';
import { getFlexibility } from '@/data/flexibility';
import { FLEX_TESTS, flexBand } from '@/lib/flexibility';
import { getStorage } from '@/lib/storage';
import { BRANCHES } from '@/lib/presets';
import { buildOverlay } from '@/lib/posture-overlay';
import { formatMetric } from '@/lib/posture-format';
import { combineViews, scorePosture, REGIONS } from '@/lib/posture-insights';
import { compareMetrics, compareScores, type Trend } from '@/lib/posture-compare';
import { POSTURE_VIEWS, type PostureView } from '@/lib/posture';
import { formatFullDate, getISTDateString } from '@/lib/dates';
import { getLocale } from '@/lib/i18n/server';
import { getTranslations } from '@/lib/i18n/translations';
import { ReportLetterhead } from '@/components/ReportLetterhead';
import { PrintButton } from '@/components/PrintButton';
import { Button } from '@/components/ui/button';
import { PostureFigure } from '@/components/posture/PostureFigure';
import { BRAND, FLEX_BAND_COLOR, SectionHeader, SeverityDot, scoreColor } from '@/components/posture/ReportParts';

const TREND_STYLE: Record<Trend, { bg: string; fg: string }> = {
  better: { bg: '#E6F0EA', fg: BRAND.green },
  worse: { bg: '#FDE8E6', fg: BRAND.red },
  same: { bg: '#F3F4F6', fg: '#4b5563' },
};

const views = (a: PostureAssessment) => a.views.map((v) => ({ view: v.view as PostureView, metrics: v.metrics }));

/** Before/after comparison of two posture assessments: `?a=<id>&b=<id>` (order is fixed by date). */
export default async function PostureComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { id } = await params;
  const { a: aId, b: bId } = await searchParams;
  if (!aId || !bId || aId === bId) notFound();
  const db = getDb();
  const patient = await getPatient(db, id);
  const [x, y] = await Promise.all([getPostureAssessment(db, aId), getPostureAssessment(db, bId)]);
  if (!patient || !x || !y || x.patientId !== id || y.patientId !== id) notFound();
  const [before, after] = `${x.assessedOn}${x.createdAt.toISOString()}` <= `${y.assessedOn}${y.createdAt.toISOString()}` ? [x, y] : [y, x];

  const t = getTranslations(await getLocale());
  const p = t.posture;
  const cmp = p.compare;
  const ins = p.insights;
  const branch = BRANCHES.find((b) => b.key === patient.branch) ?? null;
  const storage = getStorage();

  const cb = combineViews(views(before));
  const ca = combineViews(views(after));
  const scores = compareScores(scorePosture(cb), scorePosture(ca));
  const rows = compareMetrics(cb, ca);
  const [flexBefore, flexAfter] = await Promise.all([getFlexibility(db, before.id), getFlexibility(db, after.id)]);

  const photos = await Promise.all([before, after].map(async (asmt) => Object.fromEntries(await Promise.all(
    asmt.views.map(async (v) => [v.view, {
      overlay: buildOverlay(v.view as PostureView, v.landmarks, v.imageWidth, v.imageHeight),
      metrics: v.metrics,
      url: v.filePath ? await storage.createSignedUrl(v.filePath).catch(() => null) : null,
      deleted: v.filePath === null,
    }] as const),
  ))));

  const signed = (n: number | null, unit = '') => (n === null ? cmp.notMeasured : `${n > 0 ? '+' : ''}${n}${unit}`);
  const scoreCell = (n: number | null) => (
    <span className="tabular-nums font-semibold" style={{ color: n === null ? '#9ca3af' : scoreColor(n) }}>{n ?? cmp.notMeasured}</span>
  );
  // Flexibility uses its own bands (0–35 / 36–70 / 71–100), not the posture score colours.
  const flexCell = (n: number | null) => (
    <span className="tabular-nums font-semibold" style={{ color: n === null ? '#9ca3af' : FLEX_BAND_COLOR[flexBand(n)!] }}>{n ?? cmp.notMeasured}</span>
  );
  const changeCell = (n: number | null) => (
    <span className="tabular-nums font-semibold" style={{ color: n === null || n === 0 ? '#6b7280' : n > 0 ? BRAND.green : BRAND.red }}>
      {signed(n)}
    </span>
  );

  return (
    <div className="mx-auto max-w-5xl bg-white p-4 sm:p-8 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/patients/${id}?tab=assessment`}>
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
            {p.back}
          </Link>
        </Button>
        <PrintButton />
      </div>

      <ReportLetterhead badgeLabel={cmp.title} patientCode={patient.patientCode} branch={branch} today={getISTDateString()} />

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-b pb-4 text-sm sm:grid-cols-4" style={{ borderColor: BRAND.sand }}>
        <div><dt className="text-gray-500">{t.form.fullName}</dt><dd className="font-medium">{patient.fullName}</dd></div>
        <div><dt className="text-gray-500">{t.receipt.patientCode}</dt><dd className="font-medium">{patient.patientCode}</dd></div>
        <div>
          <dt className="text-gray-500">{cmp.before}</dt>
          <dd><Link href={`/patients/${id}/posture/${before.id}`} className="font-medium underline">{formatFullDate(before.assessedOn)}</Link></dd>
        </div>
        <div>
          <dt className="text-gray-500">{cmp.after}</dt>
          <dd><Link href={`/patients/${id}/posture/${after.id}`} className="font-medium underline">{formatFullDate(after.assessedOn)}</Link></dd>
        </div>
      </dl>

      {/* ── SCORES ── */}
      <SectionHeader>{cmp.scores}</SectionHeader>
      <table className="w-full max-w-xl border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-gray-500">
            <th className="py-1.5 font-medium" />
            <th className="py-1.5 text-right font-medium">{cmp.before}</th>
            <th className="py-1.5 text-right font-medium">{cmp.after}</th>
            <th className="py-1.5 text-right font-medium">{cmp.change}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b" style={{ backgroundColor: BRAND.sandLight }}>
            <td className="py-2 font-semibold" style={{ color: BRAND.green }}>{cmp.overall}</td>
            <td className="py-2 text-right">{scoreCell(scores.overall.before)}</td>
            <td className="py-2 text-right">{scoreCell(scores.overall.after)}</td>
            <td className="py-2 text-right">{changeCell(scores.overall.change)}</td>
          </tr>
          {REGIONS.map((r) => (
            <tr key={r} className="border-b border-gray-100">
              <td className="py-1.5 text-gray-700">{ins.regions[r]}</td>
              <td className="py-1.5 text-right">{scoreCell(scores.regions[r].before)}</td>
              <td className="py-1.5 text-right">{scoreCell(scores.regions[r].after)}</td>
              <td className="py-1.5 text-right">{changeCell(scores.regions[r].change)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── MEASUREMENTS ── */}
      <SectionHeader>{cmp.measures}</SectionHeader>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-gray-500">
              <th className="py-1.5 pr-2 font-medium">{p.columns.metric}</th>
              <th className="py-1.5 pr-2 font-medium">{cmp.before}</th>
              <th className="py-1.5 pr-2 font-medium">{cmp.after}</th>
              <th className="py-1.5 pr-2 text-right font-medium">{cmp.change}</th>
              <th className="py-1.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cell = (m: typeof row.before) => {
                if (!m) return <span className="text-gray-400">{cmp.notMeasured}</span>;
                const f = formatMetric(m, p);
                return (
                  <span className="flex gap-1.5">
                    <SeverityDot severity={m.severity} />
                    <span><span className="tabular-nums font-medium">{f.value}</span>{f.detail && <span className="text-gray-500"> · {f.detail}</span>}</span>
                  </span>
                );
              };
              const unit = (row.after ?? row.before)!.unit === 'deg' ? '°' : ` ${(row.after ?? row.before)!.unit}`;
              return (
                <tr key={`${row.key}-${row.limbSide ?? ''}`} className="border-b border-gray-100 align-top">
                  <td className="py-1.5 pr-2 text-gray-700">
                    {p.metrics[row.key]}{row.limbSide && ` (${p.sides[row.limbSide]})`}
                  </td>
                  <td className="py-1.5 pr-2">{cell(row.before)}</td>
                  <td className="py-1.5 pr-2">{cell(row.after)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{signed(row.change, unit)}</td>
                  <td className="py-1.5">
                    {row.trend && (
                      <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: TREND_STYLE[row.trend].bg, color: TREND_STYLE[row.trend].fg }}>
                        {cmp.trend[row.trend]}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── FLEXIBILITY ── (only when either assessment has flexibility tests) */}
      {(flexBefore.shots.length > 0 || flexAfter.shots.length > 0) && (
        <>
          <SectionHeader>{t.posture.flex.title}</SectionHeader>
          <table className="w-full max-w-xl border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="py-1.5 font-medium" />
                <th className="py-1.5 text-right font-medium">{cmp.before}</th>
                <th className="py-1.5 text-right font-medium">{cmp.after}</th>
                <th className="py-1.5 text-right font-medium">{cmp.change}</th>
              </tr>
            </thead>
            <tbody>
              {FLEX_TESTS.map((test) => {
                const b = flexBefore.scores[test]?.score ?? null, a = flexAfter.scores[test]?.score ?? null;
                return (
                  <tr key={test} className="border-b border-gray-100">
                    <td className="py-1.5 text-gray-700">{t.posture.flex.tests[test]}</td>
                    <td className="py-1.5 text-right">{flexCell(b)}</td>
                    <td className="py-1.5 text-right">{flexCell(a)}</td>
                    <td className="py-1.5 text-right">{changeCell(b !== null && a !== null ? a - b : null)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {/* ── PHOTOS ── */}
      <SectionHeader>{cmp.photos}</SectionHeader>
      <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-2">
        {POSTURE_VIEWS.map((v) => (
          <section key={v} className="print:break-inside-avoid">
            <h3 className="mb-2 text-sm font-semibold" style={{ color: BRAND.green }}>{ins.viewNames[v]}</h3>
            <div className="grid grid-cols-2 gap-2">
              {photos.map((set, i) => {
                const ph = set[v];
                return (
                  <figure key={i}>
                    {ph
                      ? <PostureFigure overlay={ph.overlay} photoUrl={ph.url} metrics={ph.metrics} alt={`${ins.viewNames[v]} — ${i === 0 ? cmp.before : cmp.after}`} noPhotoLabel={ph.deleted ? p.photoDeleted : p.noPhoto} />
                      : <div className="aspect-[1/2] rounded-md bg-muted" />}
                    <figcaption className="mt-1 text-center text-xs text-gray-500">
                      {i === 0 ? cmp.before : cmp.after} · {formatFullDate((i === 0 ? before : after).assessedOn)}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 border-t pt-4 text-xs italic text-gray-500">{p.disclaimer}</p>
    </div>
  );
}
