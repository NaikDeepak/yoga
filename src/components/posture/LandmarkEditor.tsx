'use client';

import { useMemo } from 'react';
import { shotEditablePoints, shotOverlay, shotPreviewMetrics, type CaptureShot } from '@/lib/capture-shots';
import type { Landmark } from '@/lib/posture';
import { OverlaySvg } from './PostureFigure';
import { DragHandles } from './DragHandles';

/** Captured still with draggable landmarks; the overlay and line colours update as points move. */
export function LandmarkEditor({
  imageUrl,
  width,
  height,
  shot,
  landmarks,
  onChange,
}: {
  imageUrl: string;
  width: number;
  height: number;
  /** Posture view or flexibility shot. */
  shot: CaptureShot;
  landmarks: Landmark[];
  onChange: (landmarks: Landmark[]) => void;
}) {
  const overlay = useMemo(() => shotOverlay(shot, landmarks, width, height), [shot, landmarks, width, height]);
  // Preview colours only — the server recomputes metrics on save.
  const metrics = useMemo(() => shotPreviewMetrics(shot, landmarks, { width, height }), [shot, landmarks, width, height]);

  return (
    <div className="relative mx-auto w-full overflow-hidden rounded-md bg-black" style={{ aspectRatio: `${width} / ${height}`, maxHeight: '70vh' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
      <OverlaySvg overlay={overlay} metrics={metrics} showPoints={false} className="touch-none">
        <DragHandles
          // Every point this shot uses — missed ones too, so the therapist can place them.
          handles={shotEditablePoints(shot, landmarks, width, height).map((p) => ({ id: p.index, x: p.x, y: p.y, missed: !p.detected }))}
          radius={width / 140}
          color="#ffffff"
          onMove={(index, x, y) => {
            const next = landmarks.slice();
            // A point the therapist placed is treated as fully visible.
            next[index] = {
              x: Math.min(1, Math.max(0, x / width)),
              y: Math.min(1, Math.max(0, y / height)),
              visibility: 1,
            };
            onChange(next);
          }}
        />
      </OverlaySvg>
    </div>
  );
}
