import { describe, it, expect } from 'vitest';
import { isPostureEnabled } from '@/lib/features';

describe('isPostureEnabled', () => {
  it('is on for local development and off in production by default', () => {
    expect(isPostureEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(isPostureEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(isPostureEnabled({ NODE_ENV: 'test' })).toBe(false);
  });

  it('can be switched explicitly with FEATURE_POSTURE', () => {
    expect(isPostureEnabled({ NODE_ENV: 'production', FEATURE_POSTURE: 'true' })).toBe(true);
    expect(isPostureEnabled({ NODE_ENV: 'development', FEATURE_POSTURE: 'false' })).toBe(false);
  });

  it('ignores anything other than exactly "true" / "false"', () => {
    expect(isPostureEnabled({ NODE_ENV: 'production', FEATURE_POSTURE: '1' })).toBe(false);
    expect(isPostureEnabled({ NODE_ENV: 'development', FEATURE_POSTURE: 'yes' })).toBe(true);
  });
});
