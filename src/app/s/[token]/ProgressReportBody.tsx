import type { SharedProgressReport, ProgressSeries } from '@/data/shared-progress';
import { formatFullDate } from '@/lib/dates';
import type { Translations } from '@/lib/i18n/en';
import { REGIONS } from '@/lib/posture-insights';
import type { ScoreChange } from '@/lib/posture-compare';
import { TrendChart } from '@/components/TrendChart';
import { BRAND, SectionHeader, scoreColor } from '@/components/posture/ReportParts';

const fmt = (n: number) => String(Math.round(n * 10) / 10);
/** "7 → 3" once there are two readings; just the one value before that. */
const fromTo = (s: ProgressSeries, unit = '') =>
  `${s.series.length > 1 ? `${fmt(s.first.value)} → ` : ''}${fmt(s.latest.value)}${unit}`;

/** Client's live progress report (share link kind 'progress'). Only SharedProgressReport fields. */
export function ProgressReportBody({ report, t }: { report: SharedProgressReport; t: Translations }) {
  const s = t.sharedPage;
  const g = s.progress;
  const p = t.posture;
  const { pain, weight, home, posture } = report;
  const homePainPoints = home?.painSeries.filter((d) => d.value !== null).length ?? 0;

  const stats = [
    pain && [g.pain, fromTo(pain), g.painHint],
    weight && [g.weight, fromTo(weight, ' kg'), null],
    [g.sessions, String(report.sessions), null],
    home && [g.home, g.homeDays.replace('{score}', fmt(home.adherence.score)).replace('{days}', String(home.adherence.days)),
      g.homeLast.replace('{days}', String(home.adherence.days))],
  ].filter(Boolean) as [string, string, string | null][];

  return (
    <>
      <section>
        <h1 className="text-2xl font-bold">{s.greeting.replace('{name}', report.firstName)} 🙏</h1>
        <p className="text-muted-foreground">{report.since ? g.title.replace('{date}', formatFullDate(report.since)) : g.titleNoDate}</p>
        {report.goal && <p className="mt-2 text-sm"><span className="text-muted-foreground">{g.goal}:</span> {report.goal}</p>}
      </section>

      <dl className="grid grid-cols-2 gap-3">
        {stats.map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl p-3" style={{ backgroundColor: BRAND.sandLight }}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-xl font-semibold tabular-nums" style={{ color: BRAND.green }}>{value}</dd>
            {hint && <dd className="text-[11px] text-muted-foreground">{hint}</dd>}
          </div>
        ))}
      </dl>

      {((pain?.series.length ?? 0) > 1 || (weight?.series.length ?? 0) > 1 || homePainPoints > 1) && (
        <section className="space-y-4">
          {pain && pain.series.length > 1 && <TrendChart series={pain.series} label={g.painChart} color={BRAND.red} min={0} max={10} />}
          {weight && weight.series.length > 1 && <TrendChart series={weight.series} label={g.weightChart} color={BRAND.green} />}
          {home && homePainPoints > 1 && <TrendChart series={home.painSeries} label={g.homePainChart} color={BRAND.saffron} min={0} max={10} />}
        </section>
      )}

      {posture && (
        <section>
          <SectionHeader>{g.postureTitle}</SectionHeader>
          <p className="mb-2 text-xs text-muted-foreground">
            {g.postureDates.replace('{first}', formatFullDate(posture.firstOn)).replace('{latest}', formatFullDate(posture.latestOn))}
          </p>
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr className="border-b" style={{ backgroundColor: BRAND.sandLight }}>
                <td className="py-2 pl-2 font-semibold" style={{ color: BRAND.green }}>{p.compare.overall}</td>
                <ScoreCells change={posture.overall} />
              </tr>
              {REGIONS.map((r) => (
                <tr key={r} className="border-b border-gray-100">
                  <td className="py-1.5 pl-2">{p.insights.regions[r]}</td>
                  <ScoreCells change={posture.regions[r]} />
                </tr>
              ))}
            </tbody>
          </table>
          {(['better', 'worse'] as const).map((trend) => {
            const rows = posture.changes.filter((c) => c.trend === trend);
            return rows.length > 0 && (
              <div key={trend} className="mt-3">
                <h3 className="text-sm font-semibold" style={{ color: trend === 'better' ? BRAND.green : BRAND.red }}>{g[trend]}</h3>
                <ul className="ml-5 list-disc text-sm">
                  {rows.map((c) => <li key={`${c.key}-${c.limbSide ?? ''}`}>{p.metrics[c.key]}{c.limbSide && ` (${p.sides[c.limbSide]})`}</li>)}
                </ul>
              </div>
            );
          })}
          <p className="mt-2 text-xs text-muted-foreground">{g.postureNote}</p>
        </section>
      )}

      <p className="text-center text-lg font-semibold" style={{ color: BRAND.green }}>{g.keepGoing}</p>
    </>
  );
}

function ScoreCells({ change }: { change: ScoreChange }) {
  const cell = (n: number | null) => (
    <span className="font-semibold tabular-nums" style={{ color: n === null ? '#9ca3af' : scoreColor(n) }}>{n ?? '—'}</span>
  );
  return (
    <td className="py-1.5 pr-2 text-right">
      {cell(change.before)} <span className="text-muted-foreground">→</span> {cell(change.after)}
    </td>
  );
}
