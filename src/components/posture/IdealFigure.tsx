import { IDEAL_PHOTOS } from '@/lib/ideal-photos';
import type { CaptureShot } from '@/lib/capture-shots';

/** The ideal reference photo for a posture view or flexibility shot, labelled (spec 2026-10-06-ideal-figure). */
export function IdealFigure({ shot, label }: { shot: CaptureShot; label: string }) {
  const { src, width, height } = IDEAL_PHOTOS[shot];
  return (
    <div className="relative overflow-hidden rounded-md bg-muted" style={{ aspectRatio: `${width} / ${height}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
      <span aria-hidden="true" className="absolute left-1.5 top-1.5 rounded bg-emerald-700/85 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">{label}</span>
    </div>
  );
}
