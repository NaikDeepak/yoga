import { idealPhotoFigure } from '@/lib/ideal-figures';
import type { CaptureShot } from '@/lib/capture-shots';
import { OverlaySvg } from './PostureFigure';

/**
 * The ideal reference for a posture view or flexibility shot: a model photo with the ideal skeleton
 * fitted onto it (spec 2026-10-06-ideal-figure). The skeleton is the measured ideal; the photo only
 * illustrates it, so lines may not sit exactly on the model's joints.
 */
export function IdealFigure({ shot, label }: { shot: CaptureShot; label: string }) {
  const { src, overlay, metrics } = idealPhotoFigure(shot);
  return (
    <div className="relative overflow-hidden rounded-md bg-muted" style={{ aspectRatio: `${overlay.width} / ${overlay.height}` }} role="img" aria-label={label}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
      <span className="absolute left-1.5 top-1.5 rounded bg-emerald-700/85 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">{label}</span>
      <OverlaySvg overlay={overlay} metrics={metrics} />
    </div>
  );
}
