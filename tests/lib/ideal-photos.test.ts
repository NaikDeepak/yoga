import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { imageSize } from '../helpers/image-size';
import { IDEAL_PHOTOS } from '@/lib/ideal-photos';
import { POSTURE_VIEWS } from '@/lib/posture';

describe('ideal reference photos', () => {
  it('exist for all four posture views, the fold and the butterfly — not shoulder extension (no photo reached 60°)', () => {
    expect(Object.keys(IDEAL_PHOTOS).sort()).toEqual([...POSTURE_VIEWS, 'forwardFold', 'butterfly'].sort());
  });

  it('point at real files whose size matches the declared one', () => {
    for (const [shot, p] of Object.entries(IDEAL_PHOTOS)) {
      const file = `public${p!.src}`;
      expect(existsSync(file), shot).toBe(true);
      expect(imageSize(file), shot).toEqual({ width: p!.width, height: p!.height });
    }
  });
});
