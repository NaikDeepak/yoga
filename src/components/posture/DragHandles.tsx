'use client';

import { useRef, useState } from 'react';
import { svgPoint } from './hooks';

/** `missed`: a point the detector didn't find — drawn hollow and dashed until the therapist places it. */
const MISSED_COLOR = '#f97316';

export interface Handle { id: number; x: number; y: number; missed?: boolean }

/**
 * Draggable circles inside an <svg> (rendered as children of OverlaySvg). Pointer events work for
 * mouse and touch; the parent SVG needs `touch-action: none` so dragging doesn't scroll the page.
 */
export function DragHandles({
  handles,
  radius,
  onMove,
  color = '#f97316',
}: {
  handles: Handle[];
  radius: number;
  onMove: (id: number, x: number, y: number) => void;
  color?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  return (
    <g>
      {handles.map((h) => (
        <g key={h.id}>
          {/* Larger invisible hit area for fingers */}
          <circle
            cx={h.x}
            cy={h.y}
            r={radius * 3}
            fill="transparent"
            style={{ cursor: 'grab', pointerEvents: 'all' }}
            onPointerDown={(e) => {
              svgRef.current = (e.currentTarget.ownerSVGElement as SVGSVGElement | null);
              e.currentTarget.setPointerCapture(e.pointerId);
              setActive(h.id);
            }}
            onPointerMove={(e) => {
              if (active !== h.id || !svgRef.current) return;
              const p = svgPoint(svgRef.current, e.clientX, e.clientY);
              onMove(h.id, p.x, p.y);
            }}
            onPointerUp={() => setActive(null)}
            onPointerCancel={() => setActive(null)}
          />
          <circle
            cx={h.x}
            cy={h.y}
            r={active === h.id ? radius * 1.5 : radius}
            fill={h.missed ? 'rgba(249,115,22,0.25)' : color}
            stroke={h.missed ? MISSED_COLOR : '#ffffff'}
            strokeWidth={h.missed ? radius / 2 : radius / 3}
            strokeDasharray={h.missed ? `${radius / 1.5} ${radius / 2}` : undefined}
            style={{ pointerEvents: 'none' }}
          />
        </g>
      ))}
    </g>
  );
}
