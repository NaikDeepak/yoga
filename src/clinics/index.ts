import { clinicProfileSchema, type ClinicProfile } from './types';
import { pawar } from './pawar';

export const CLINIC_REGISTRY: Record<string, ClinicProfile> = {
  pawar,
};

export function resolveClinicProfile(slug?: string): ClinicProfile {
  const targetSlug = slug || process.env.CLINIC_PROFILE || 'pawar';
  const profile = CLINIC_REGISTRY[targetSlug];
  if (!profile) {
    throw new Error(
      `Unknown clinic profile: "${targetSlug}". Available: ${Object.keys(CLINIC_REGISTRY).join(', ')}`
    );
  }
  return clinicProfileSchema.parse(profile);
}

export const clinicProfile: ClinicProfile = resolveClinicProfile();

export function clinicName(locale: 'en' | 'mr', short = false): string {
  return short ? clinicProfile.shortName[locale] : clinicProfile.name[locale];
}
