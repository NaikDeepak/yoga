import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { imageSize } from '../helpers/image-size';
import { IDEAL_PHOTOS, IDEAL_SHOTS } from '@/lib/ideal-photos';
import { POSTURE_VIEWS } from '@/lib/posture';
import { FLEX_SHOTS } from '@/lib/flexibility';

describe('ideal reference photos', () => {
  it('cover every posture view and flexibility shot', () => {
    expect([...IDEAL_SHOTS].sort()).toEqual([...POSTURE_VIEWS, ...FLEX_SHOTS].sort());
    expect(Object.keys(IDEAL_PHOTOS).sort()).toEqual([...IDEAL_SHOTS].sort());
  });

  it('point at real files whose size matches the declared aspect ratio', () => {
    for (const shot of IDEAL_SHOTS) {
      const p = IDEAL_PHOTOS[shot];
      const file = `public${p.src}`;
      expect(existsSync(file), shot).toBe(true);
      expect(imageSize(file), shot).toEqual({ width: p.width, height: p.height });
    }
  });
});
