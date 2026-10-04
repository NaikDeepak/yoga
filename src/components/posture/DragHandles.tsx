'use client';

import { useRef, useState } from 'react';
import { svgPoint } from './hooks';

export interface Handle { id: number; x: number; y: number }

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
            fill={color}
            stroke="#ffffff"
            strokeWidth={radius / 3}
            style={{ pointerEvents: 'none' }}
          />
        </g>
      ))}
    </g>
  );
}
