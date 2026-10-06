import { idealFigure } from '@/lib/ideal-figures';
import type { CaptureShot } from '@/lib/capture-shots';
import { OverlaySvg } from './PostureFigure';

/**
 * The ideal reference figure for a posture view or flexibility shot, drawn with the same overlay as the
 * client's photo (spec 2026-10-06-ideal-figure). Shown beside the photo, labelled.
 */
export function IdealFigure({ shot, label }: { shot: CaptureShot; label: string }) {
  const { overlay, metrics } = idealFigure(shot);
  return (
    <div className="relative overflow-hidden rounded-md bg-slate-700" style={{ aspectRatio: `${overlay.width} / ${overlay.height}` }} role="img" aria-label={label}>
      <span className="absolute inset-x-0 top-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-emerald-200">{label}</span>
      <OverlaySvg overlay={overlay} metrics={metrics} />
    </div>
  );
}
