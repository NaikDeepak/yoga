// Display text for posture metrics, from the `posture` section of the i18n dictionary.
import type { Translations } from './i18n/en';
import type { Metric, MetricKey, PostureView, Severity } from './posture';

type PostureDict = Translations['posture'];

export interface FormattedMetric {
  label: string;
  value: string;
  detail: string;
  status: string;
  severity: Severity | null;
  approx: boolean;
}

const LEVELS = new Set<MetricKey>(['headTilt', 'shoulderLevel', 'pelvicLevel']);
const SHIFTS = new Set<MetricKey>(['trunkShift', 'headShift']);

function formatValue(m: Metric, d: PostureDict): string {
  if (m.value === null) return d.notMeasurable;
  if (m.unit === 'deg') return `${m.value}°`;
  if (m.unit === 'cm') return `${m.value} cm`;
  return `${m.value}${d.pctOfHeight}`;
}

function formatDetail(m: Metric, d: PostureDict): string {
  const side = m.side ? d.sides[m.side] : null;
  if (LEVELS.has(m.key)) return side ? d.lower.replace('{side}', side) : '';
  if (SHIFTS.has(m.key)) return side ? d.shiftedTo.replace('{side}', side.toLowerCase()) : '';
  const parts = [side, m.direction ? d.directions[m.direction] : null].filter(Boolean);
  return parts.join(' · ');
}

export function formatMetric(m: Metric, d: PostureDict): FormattedMetric {
  return {
    label: d.metrics[m.key],
    value: formatValue(m, d),
    detail: formatDetail(m, d),
    status: m.severity ? d.severity[m.severity] : '—',
    severity: m.severity,
    approx: m.approx,
  };
}

export interface FindingsSummary {
  mild: number;
  marked: number;
  /** Mild and marked findings across all views, marked first. */
  items: { view: PostureView; metric: Metric }[];
}

export function summarizeFindings(views: { view: PostureView; metrics: Metric[] }[]): FindingsSummary {
  const items = views.flatMap((v) =>
    v.metrics.filter((m) => m.severity === 'mild' || m.severity === 'marked').map((metric) => ({ view: v.view, metric })),
  );
  items.sort((a, b) => Number(b.metric.severity === 'marked') - Number(a.metric.severity === 'marked'));
  return {
    mild: items.filter((i) => i.metric.severity === 'mild').length,
    marked: items.filter((i) => i.metric.severity === 'marked').length,
    items,
  };
}
