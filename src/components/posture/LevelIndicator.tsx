'use client';

import { isLevel, LEVEL_TOLERANCE, type Level } from '@/lib/posture-capture';

/** Spirit-level bubble: centred and green when the camera is upright. Pitch moves it vertically, roll sideways. */
export function LevelIndicator({ level, label }: { level: Level; label: string }) {
  const ok = isLevel(level);
  const R = 28;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  // Full deflection at 3× tolerance so the bubble is sensitive near level.
  const dx = clamp(level.rollDeg / (LEVEL_TOLERANCE.rollDeg * 3)) * (R - 8);
  const dy = clamp((level.pitchDeg ?? 0) / (LEVEL_TOLERANCE.pitchDeg * 3)) * (R - 8);
  return (
    <div className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white">
      <svg width={R * 2} height={R * 2} viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`} aria-hidden="true">
        <circle r={R - 1} fill="none" stroke="white" strokeOpacity={0.6} />
        <circle r={(R - 8) / 3} fill="none" stroke="white" strokeOpacity={0.6} strokeDasharray="2 2" />
        <line x1={-R} x2={R} y1={0} y2={0} stroke="white" strokeOpacity={0.3} />
        <line y1={-R} y2={R} x1={0} x2={0} stroke="white" strokeOpacity={0.3} />
        <circle cx={dx} cy={dy} r={7} fill={ok ? '#22c55e' : '#ef4444'} />
      </svg>
      <span className="tabular-nums">{label}</span>
    </div>
  );
}
