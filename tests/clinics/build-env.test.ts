import { describe, it, expect } from 'vitest';
import { clinicProfileForBuild, CLINIC_PROFILE_MISSING } from '@/clinics/build-env';

describe('clinicProfileForBuild', () => {
  it('passes a set value through', () => {
    expect(clinicProfileForBuild({ CLINIC_PROFILE: 'other', NODE_ENV: 'production' })).toBe('other');
  });
  it('throws in production when missing or empty', () => {
    expect(() => clinicProfileForBuild({ NODE_ENV: 'production' })).toThrow(CLINIC_PROFILE_MISSING);
    expect(() => clinicProfileForBuild({ CLINIC_PROFILE: '', NODE_ENV: 'production' })).toThrow(/CLINIC_PROFILE is not set/);
  });
  it('defaults to pawar outside production', () => {
    expect(clinicProfileForBuild({ NODE_ENV: 'development' })).toBe('pawar');
    expect(clinicProfileForBuild({ CLINIC_PROFILE: '' })).toBe('pawar');
  });
});
