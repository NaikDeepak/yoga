import { clinicProfileSchema, type ClinicProfile } from './types';
import { pawar } from './pawar';

export const CLINIC_REGISTRY: Record<string, ClinicProfile> = {
  pawar,
};

/** Outside production an unset CLINIC_PROFILE falls back to pawar; in production it throws, so a
 *  deploy can never silently show one clinic's name and branding to another. */
export function resolveClinicProfile(
  slug?: string,
  env: Record<string, string | undefined> = process.env,
): ClinicProfile {
  const requested = slug || env.CLINIC_PROFILE;
  if (!requested && env.NODE_ENV === 'production') {
    throw new Error('CLINIC_PROFILE is not set. Set it in Vercel (Production, build and runtime).');
  }
  const targetSlug = requested || 'pawar';
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
