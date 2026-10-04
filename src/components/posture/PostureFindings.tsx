import { formatMetric } from '@/lib/posture-format';
import type { Metric, Severity } from '@/lib/posture';
import type { Translations } from '@/lib/i18n/en';

export const SEVERITY_CHIP: Record<Severity, string> = {
  normal: 'bg-primary/10 text-primary',
  mild: 'bg-yellow-100 text-yellow-800',
  marked: 'bg-destructive/10 text-destructive',
};

export function SeverityChip({ severity, label }: { severity: Severity | null; label: string }) {
  if (!severity) return <span className="text-muted-foreground">{label}</span>;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium print:border ${SEVERITY_CHIP[severity]}`}>
      {label}
    </span>
  );
}

/** Findings table for one view. */
export function PostureFindings({ metrics, t }: { metrics: Metric[]; t: Translations['posture'] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="py-1.5 pr-2 font-medium">{t.columns.metric}</th>
          <th className="py-1.5 pr-2 font-medium">{t.columns.value}</th>
          <th className="py-1.5 pr-2 font-medium">{t.columns.detail}</th>
          <th className="py-1.5 font-medium">{t.columns.status}</th>
        </tr>
      </thead>
      <tbody>
        {metrics.map((m, i) => {
          const f = formatMetric(m, t);
          return (
            <tr key={`${m.key}-${m.side ?? i}`} className="border-b border-border/60 align-top">
              <td className="py-1.5 pr-2">
                {f.label}
                {f.approx && <span className="ml-1 text-[10px] uppercase text-muted-foreground">({t.approx})</span>}
              </td>
              <td className={`py-1.5 pr-2 tabular-nums ${m.value === null ? 'text-muted-foreground' : ''}`}>{f.value}</td>
              <td className="py-1.5 pr-2 text-muted-foreground">{f.detail}</td>
              <td className="py-1.5"><SeverityChip severity={f.severity} label={f.status} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
