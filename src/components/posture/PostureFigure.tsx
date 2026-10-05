import type { ReactNode } from 'react';
import type { Overlay } from '@/lib/posture-overlay';
import type { Metric, Severity } from '@/lib/posture';

// High-contrast colours: lines sit on top of arbitrary photos.
export const SEVERITY_STROKE: Record<Severity | 'none', string> = {
  normal: '#22c55e',
  mild: '#eab308',
  marked: '#ef4444',
  none: '#38bdf8',
};

/**
 * Skeleton, reference lines and colour-coded measures, in the image's pixel space.
 * Lay it over an element with the same aspect ratio (see PostureFigure). `children` render on top
 * (e.g. draggable handles), in the same coordinate space.
 */
export function OverlaySvg({
  overlay,
  metrics = [],
  showPoints = true,
  children,
  svgRef,
  className = '',
}: {
  overlay: Overlay;
  metrics?: Metric[];
  showPoints?: boolean;
  children?: ReactNode;
  svgRef?: React.Ref<SVGSVGElement>;
  className?: string;
}) {
  const { width, height } = overlay;
  const sw = width / 250; // stroke width scales with the image, so lines look the same at any size
  const severityOf = (key?: string) => metrics.find((m) => m.key === key)?.severity ?? 'none';
  const coords = (l: { x1: number; y1: number; x2: number; y2: number }) => ({ x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 });

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className={`absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    >
      {overlay.lines.filter((l) => l.kind === 'reference').map((l, i) => (
        <line key={`r${i}`} {...coords(l)} stroke="#ffffff" strokeOpacity={0.85} strokeWidth={sw * 0.6} strokeDasharray={`${sw * 3} ${sw * 2}`} />
      ))}
      {overlay.lines.filter((l) => l.kind === 'bone').map((l, i) => (
        <line key={`b${i}`} {...coords(l)} stroke="#ffffff" strokeOpacity={0.9} strokeWidth={sw} strokeLinecap="round" />
      ))}
      {overlay.lines.filter((l) => l.kind === 'measure').map((l, i) => (
        <line key={`m${i}`} {...coords(l)} stroke={SEVERITY_STROKE[severityOf(l.metric)]} strokeWidth={sw * 1.6} strokeLinecap="round" />
      ))}
      {showPoints && overlay.points.map((p) => (
        <circle key={`p${p.index}`} cx={p.x} cy={p.y} r={sw * 1.6} fill="#ffffff" stroke="#0f172a" strokeWidth={sw * 0.5} />
      ))}
      {children}
    </svg>
  );
}

/** Posture photo with the overlay on top. */
export function PostureFigure({
  overlay,
  photoUrl,
  metrics,
  alt,
  noPhotoLabel,
}: {
  overlay: Overlay;
  photoUrl: string | null;
  metrics: Metric[];
  alt: string;
  noPhotoLabel: string;
}) {
  return (
    // Without a photo the overlay's white skeleton needs a dark backdrop to be visible (e.g. shared without photos).
    <div
      className={`relative overflow-hidden rounded-md ${photoUrl ? 'bg-muted' : 'bg-slate-700'}`}
      style={{ aspectRatio: `${overlay.width} / ${overlay.height}` }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={alt} className="absolute inset-0 h-full w-full object-contain" />
      ) : (
        <span className="absolute inset-x-0 top-2 text-center text-xs text-slate-200">{noPhotoLabel}</span>
      )}
      <OverlaySvg overlay={overlay} metrics={metrics} />
    </div>
  );
}
