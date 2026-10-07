import { describe, it, expect } from 'vitest';
import { isPostureEnabled, isFeatureEnabled } from '@/lib/features';

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

describe('isFeatureEnabled', () => {
  it('follows the clinic profile by default, in every environment', () => {
    for (const NODE_ENV of ['development', 'production']) {
      expect(isFeatureEnabled('flexibility', { NODE_ENV })).toBe(true);
      expect(isFeatureEnabled('ai', { NODE_ENV })).toBe(true);
      expect(isFeatureEnabled('shareLinks', { NODE_ENV })).toBe(true);
      expect(isFeatureEnabled('checkins', { NODE_ENV })).toBe(true);
    }
  });

  it('an env var FEATURE_<NAME> overrides the profile both ways', () => {
    expect(isFeatureEnabled('flexibility', { FEATURE_FLEXIBILITY: 'false' })).toBe(false);
    expect(isFeatureEnabled('shareLinks', { FEATURE_SHARE_LINKS: 'false' })).toBe(false);
    expect(isFeatureEnabled('ai', { FEATURE_AI: 'true' })).toBe(true);
    expect(isFeatureEnabled('ai', { FEATURE_AI: 'yes' })).toBe(true);
  });
});
