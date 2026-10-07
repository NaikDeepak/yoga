// Feature flags. Server-side only (read at request time from the environment).
import { clinicProfile } from '@/clinics';
import type { ClinicProfile } from '@/clinics/types';

export type ClinicFeature = keyof ClinicProfile['features'];

type Env = Record<string, string | undefined>;

/** FEATURE_<NAME> ("true"/"false", e.g. FEATURE_SHARE_LINKS) overrides the clinic profile's switch. */
export function isFeatureEnabled(name: ClinicFeature, env: Env = process.env): boolean {
  const override = env[`FEATURE_${name.replace(/([A-Z])/g, '_$1').toUpperCase()}`];
  if (override === 'true') return true;
  if (override === 'false') return false;
  return clinicProfile.features[name];
}

/**
 * AI posture analysis is a premium feature still being built on. It's visible in local development
 * (`npm run dev` / `dev:phone`) and hidden in production unless FEATURE_POSTURE=true is set
 * (FEATURE_POSTURE=false hides it locally too). Hiding the entry point is the intended soft barrier —
 * the posture routes themselves stay reachable by URL for signed-in staff.
 */
export function isPostureEnabled(env: Env = process.env): boolean {
  if (env.FEATURE_POSTURE === 'true') return true;
  if (env.FEATURE_POSTURE === 'false') return false;
  return clinicProfile.features.posture && env.NODE_ENV === 'development';
}
