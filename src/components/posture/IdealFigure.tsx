import { IDEAL_PHOTOS } from '@/lib/ideal-photos';
import type { CaptureShot } from '@/lib/capture-shots';

/**
 * The ideal reference photo for a posture view or flexibility shot, labelled (spec 2026-10-06-ideal-figure).
 * Nothing when that shot has no photo. Loaded eagerly so a printed / PDF report never shows empty boxes.
 */
export function IdealFigure({ shot, label, name }: { shot: CaptureShot; label: string; name: string }) {
  const photo = IDEAL_PHOTOS[shot];
  if (!photo) return null;
  return (
    <div className="relative overflow-hidden rounded-md bg-muted" style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.src} alt={`${label} — ${name}`} className="absolute inset-0 h-full w-full object-contain" />
      <span aria-hidden="true" className="absolute left-1.5 top-1.5 rounded bg-emerald-700/85 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">{label}</span>
    </div>
  );
}
