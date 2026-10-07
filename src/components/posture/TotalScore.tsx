import type { Translations } from '@/lib/i18n/en';
import { TOTAL_MAX, type TotalParts } from '@/lib/total-score';
import { FLEX_TESTS } from '@/lib/flexibility';
import { BRAND } from './ReportParts';

/** "288/400 · Posture 82 · Shoulder extension 78 · …" (spec 2026-10-07-total-score). Only rendered when complete. */
export function TotalScore({ total, parts, t }: { total: number; parts: TotalParts; t: Translations }) {
  const tt = t.posture.total;
  const items: [string, number][] = [[tt.posture, parts.posture], ...FLEX_TESTS.map((k) => [t.posture.flex.tests[k], parts[k]] as [string, number])];
  return (
    <section className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border p-4 print:break-inside-avoid" style={{ borderColor: BRAND.sand }}>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{tt.title}</p>
        <p className="tabular-nums" style={{ color: BRAND.green }}>
          <span className="text-3xl font-bold">{total}</span>
          <span className="text-sm text-gray-500">/{TOTAL_MAX}</span>
        </p>
      </div>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {items.map(([label, value]) => (
          <div key={label} className="flex gap-1"><dt className="text-gray-500">{label}</dt><dd className="font-semibold tabular-nums">{value}</dd></div>
        ))}
      </dl>
      <p className="w-full text-xs text-gray-500">{tt.note}</p>
    </section>
  );
}
