// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { LandmarkEditor } from '@/components/posture/LandmarkEditor';
import { LM } from '@/lib/posture';
import { alignedLandmarks, POSTURE_W, POSTURE_H } from '../helpers/posture';

beforeAll(() => {
  // jsdom lacks pointer capture, SVG screen matrices, DOMPoint and PointerEvent.
  Element.prototype.setPointerCapture = vi.fn();
  (SVGSVGElement.prototype as unknown as { getScreenCTM: () => unknown }).getScreenCTM = () => ({ inverse: () => ({}) });
  (globalThis as unknown as { DOMPoint: unknown }).DOMPoint = class {
    constructor(public x: number, public y: number) {}
    matrixTransform() { return this; }
  };
  if (!('PointerEvent' in globalThis)) {
    (globalThis as unknown as { PointerEvent: unknown }).PointerEvent = class extends MouseEvent {};
  }
});

function setup() {
  const landmarks = alignedLandmarks('front');
  landmarks[LM.LEFT_EAR] = { x: 0.6, y: 0.1, visibility: 0.1 }; // missed by the detector
  const onChange = vi.fn();
  const { container } = render(
    <LandmarkEditor imageUrl="data:," width={POSTURE_W} height={POSTURE_H} view="front" landmarks={landmarks} onChange={onChange} />,
  );
  return { container, onChange };
}

describe('LandmarkEditor', () => {
  it('shows a dashed handle for each point the detector missed', () => {
    const { container } = setup();
    const dashed = [...container.querySelectorAll('circle[stroke-dasharray]')];
    // the missed ear, plus both elbows (the fixture has no elbow points)
    expect(dashed).toHaveLength(3);
    expect(dashed.some((c) => c.getAttribute('cx') === '600' && c.getAttribute('cy') === '200')).toBe(true);
    // detected points (e.g. shoulders) are solid
    expect(container.querySelectorAll('circle[fill="#ffffff"]').length).toBeGreaterThan(0);
  });

  it('dragging a missed point places it and marks it visible', () => {
    const { container, onChange } = setup();
    // Each handle = [hit area, visible circle]; find the hit area sitting on the missed ear.
    const hit = [...container.querySelectorAll('circle[fill="transparent"]')]
      .find((c) => c.getAttribute('cx') === '600' && c.getAttribute('cy') === '200')!;
    fireEvent.pointerDown(hit, { pointerId: 1, clientX: 600, clientY: 200 });
    fireEvent.pointerMove(hit, { pointerId: 1, clientX: 555, clientY: 260 });
    const placed = onChange.mock.calls.at(-1)![0][LM.LEFT_EAR];
    expect(placed).toEqual({ x: 0.555, y: 0.13, visibility: 1 });
  });
});
