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
  it('is on for local development and off in production by default for profile features', () => {
    expect(isFeatureEnabled('flexibility', { NODE_ENV: 'development' })).toBe(true);
    expect(isFeatureEnabled('flexibility', { NODE_ENV: 'production' })).toBe(false);
    expect(isFeatureEnabled('ai', { NODE_ENV: 'development' })).toBe(true);
    expect(isFeatureEnabled('ai', { NODE_ENV: 'production' })).toBe(false);
    expect(isFeatureEnabled('shareLinks', { NODE_ENV: 'development' })).toBe(true);
    expect(isFeatureEnabled('shareLinks', { NODE_ENV: 'production' })).toBe(false);
    expect(isFeatureEnabled('checkins', { NODE_ENV: 'development' })).toBe(true);
    expect(isFeatureEnabled('checkins', { NODE_ENV: 'production' })).toBe(false);
  });

  it('an env var overrides the profile both ways', () => {
    // Override to true in production
    expect(isFeatureEnabled('flexibility', { NODE_ENV: 'production', FEATURE_FLEXIBILITY: 'true' })).toBe(true);
    expect(isFeatureEnabled('ai', { NODE_ENV: 'production', FEATURE_AI: 'true' })).toBe(true);
    expect(isFeatureEnabled('shareLinks', { NODE_ENV: 'production', FEATURE_SHARE_LINKS: 'true' })).toBe(true);
    expect(isFeatureEnabled('shareLinks', { NODE_ENV: 'production', FEATURE_SHARELINKS: 'true' })).toBe(true);

    // Override to false in development
    expect(isFeatureEnabled('flexibility', { NODE_ENV: 'development', FEATURE_FLEXIBILITY: 'false' })).toBe(false);
    expect(isFeatureEnabled('ai', { NODE_ENV: 'development', FEATURE_AI: 'false' })).toBe(false);
    expect(isFeatureEnabled('shareLinks', { NODE_ENV: 'development', FEATURE_SHARE_LINKS: 'false' })).toBe(false);
    expect(isFeatureEnabled('shareLinks', { NODE_ENV: 'development', FEATURE_SHARELINKS: 'false' })).toBe(false);
  });

  it('production stays off without the env var', () => {
    expect(isFeatureEnabled('posture', { NODE_ENV: 'production' })).toBe(false);
    expect(isFeatureEnabled('flexibility', { NODE_ENV: 'production' })).toBe(false);
    expect(isFeatureEnabled('ai', { NODE_ENV: 'production' })).toBe(false);
    expect(isFeatureEnabled('shareLinks', { NODE_ENV: 'production' })).toBe(false);
    expect(isFeatureEnabled('checkins', { NODE_ENV: 'production' })).toBe(false);
  });
});
