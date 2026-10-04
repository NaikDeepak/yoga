import type { ReactNode } from 'react';
import type { Grade, RegionScore } from '@/lib/posture-insights';
import type { Severity } from '@/lib/posture';

// Clinic palette (matches ReportLetterhead / receipts).
export const BRAND = {
  green: '#1B3A2E',
  saffron: '#C8962E',
  sand: '#E5D5B5',
  sandLight: '#FAF6EE',
  red: '#B42318',
} as const;

const GRADE_COLOR: Record<Grade, string> = { good: BRAND.green, fair: BRAND.saffron, needsAttention: BRAND.red };

export const scoreColor = (score: number) => (score >= 85 ? BRAND.green : score >= 65 ? BRAND.saffron : BRAND.red);

/** Donut gauge for the overall posture score. */
export function ScoreRing({ score, grade, gradeLabel, outOf }: { score: number; grade: Grade; gradeLabel: string; outOf: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <svg width="148" height="148" viewBox="0 0 148 148" role="img" aria-label={`${score}${outOf} ${gradeLabel}`}>
        <circle cx="74" cy="74" r={r} fill="none" stroke={BRAND.sand} strokeWidth="14" />
        <circle
          cx="74" cy="74" r={r} fill="none" stroke={GRADE_COLOR[grade]} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 74 74)"
        />
        <text x="74" y="78" textAnchor="middle" fontSize="38" fontWeight="700" fill={BRAND.green}>{score}</text>
        <text x="74" y="100" textAnchor="middle" fontSize="12" fill="#6b7280">{outOf}</text>
      </svg>
      <span className="mt-1 rounded-full px-3 py-0.5 text-sm font-semibold text-white" style={{ backgroundColor: GRADE_COLOR[grade] }}>
        {gradeLabel}
      </span>
    </div>
  );
}

/** One row per body region: label, bar, score. */
export function RegionBars({ rows, notMeasured }: { rows: { label: string; region: RegionScore }[]; notMeasured: string }) {
  return (
    <ul className="space-y-2.5">
      {rows.map(({ label, region }) => (
        <li key={label} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_2.5rem]">
          <span className="truncate text-gray-700">{label}</span>
          <span className="h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: BRAND.sand }}>
            {region.score !== null && (
              <span className="block h-full rounded-full" style={{ width: `${region.score}%`, backgroundColor: scoreColor(region.score) }} />
            )}
          </span>
          <span className="text-right tabular-nums font-medium" style={{ color: region.score === null ? '#9ca3af' : scoreColor(region.score) }}>
            {region.score ?? '—'}
          </span>
        </li>
      ))}
      {rows.every((r) => r.region.score === null) && <li className="text-sm text-muted-foreground">{notMeasured}</li>}
    </ul>
  );
}

export function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 mt-8 border-l-4 pl-3" style={{ borderColor: BRAND.saffron }}>
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-600">{children}</h2>
    </div>
  );
}

const SEV_STYLE: Record<'mild' | 'marked', { bg: string; fg: string }> = {
  mild: { bg: '#FBF1DC', fg: '#8A5A00' },
  marked: { bg: '#FDE8E6', fg: BRAND.red },
};

export function PatternCard({
  title, severity, severityLabel, summary, evidence, causesTitle, causes, effectsTitle, effects,
}: {
  title: string; severity: 'mild' | 'marked'; severityLabel: string; summary: string; evidence: string[];
  causesTitle: string; causes: string[]; effectsTitle: string; effects: string[];
}) {
  const s = SEV_STYLE[severity];
  return (
    <article className="rounded-lg border p-4 print:break-inside-avoid" style={{ borderColor: BRAND.sand, backgroundColor: BRAND.sandLight }}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold" style={{ color: BRAND.green }}>{title}</h3>
        <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: s.bg, color: s.fg }}>{severityLabel}</span>
      </div>
      <p className="mt-1 text-sm text-gray-700">{summary}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {evidence.map((e) => <li key={e} className="rounded bg-white px-2 py-0.5 text-xs text-gray-600 ring-1 ring-gray-200">{e}</li>)}
      </ul>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <BulletList title={causesTitle} items={causes} />
        <BulletList title={effectsTitle} items={effects} />
      </div>
    </article>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <ul className="list-disc space-y-0.5 pl-4 text-sm text-gray-700">
        {items.map((i) => <li key={i}>{i}</li>)}
      </ul>
    </div>
  );
}

export function SeverityDot({ severity }: { severity: Severity | null }) {
  const color = severity === 'marked' ? BRAND.red : severity === 'mild' ? BRAND.saffron : severity === 'normal' ? BRAND.green : '#d1d5db';
  return <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />;
}
