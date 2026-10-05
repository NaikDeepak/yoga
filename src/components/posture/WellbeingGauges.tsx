import { gaugeFraction } from '@/lib/wellbeing';
import { BRAND } from './ReportParts';

const AMBER = '#D97706';

interface GaugeBand { to: number; color: string }

/** Semicircle gauge: coloured bands from min to max, needle at value. Prints as drawn. */
function Gauge({ value, min, max, bands, display, caption, label }: {
  value: number;
  min: number;
  max: number;
  bands: GaugeBand[]; // ascending `to`, last = max
  display: string;
  caption: string;
  label: string;
}) {
  const cx = 80, cy = 80, r = 62;
  const point = (f: number, radius = r) => {
    const a = Math.PI * (1 - f); // 0 = left end, 1 = right end
    return [cx + radius * Math.cos(a), cy - radius * Math.sin(a)];
  };
  let from = min;
  const arcs = bands.map(({ to, color }) => {
    const [x1, y1] = point(gaugeFraction(from, min, max));
    const [x2, y2] = point(gaugeFraction(to, min, max));
    from = to;
    return <path key={to} d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`} stroke={color} strokeWidth="14" fill="none" />;
  });
  const [nx, ny] = point(gaugeFraction(value, min, max), r - 18);
  return (
    <figure className="flex flex-col items-center">
      <figcaption className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-600">{label}</figcaption>
      <svg width="160" height="96" viewBox="0 0 160 96" role="img" aria-label={`${label}: ${display} ${caption}`}>
        {arcs}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={BRAND.green} strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill={BRAND.green} />
      </svg>
      <p className="text-xl font-bold tabular-nums" style={{ color: BRAND.green }}>{display}</p>
      <p className="text-xs text-gray-600">{caption}</p>
    </figure>
  );
}

export function BmiGauge({ bmi, caption, label }: { bmi: number; caption: string; label: string }) {
  return (
    <Gauge
      value={bmi} min={15} max={35} display={String(bmi)} caption={caption} label={label}
      bands={[{ to: 18.5, color: '#60A5FA' }, { to: 25, color: BRAND.green }, { to: 30, color: AMBER }, { to: 35, color: BRAND.red }]}
    />
  );
}

export function StressGauge({ level, caption, label }: { level: number; caption: string; label: string }) {
  return (
    <Gauge
      value={level} min={1} max={10} display={`${level}/10`} caption={caption} label={label}
      bands={[{ to: 4.5, color: BRAND.green }, { to: 7.5, color: AMBER }, { to: 10, color: BRAND.red }]}
    />
  );
}
