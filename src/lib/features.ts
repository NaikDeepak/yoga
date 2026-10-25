// Feature flags. Server-side only (read at request time from the environment).
import { clinicProfile } from '@/clinics';
import type { ClinicProfile } from '@/clinics/types';

export type ClinicFeature = keyof ClinicProfile['features'];

type Env = Record<string, string | undefined>;

/**
 * One rule for every module: FEATURE_<NAME> env ("true"/"false", e.g. FEATURE_SHARE_LINKS) is the kill
 * switch, then (later) the admin override, then the clinic profile's switch. Anything else in the env is ignored.
 */
export function isFeatureEnabled(name: ClinicFeature, env: Env = process.env): boolean {
  const override = env[`FEATURE_${name.replace(/([A-Z])/g, '_$1').toUpperCase()}`];
  if (override === 'true') return true;
  if (override === 'false') return false;
  // Admin override (Project 3) slots in here, between the env kill switch and the profile default.
  return clinicProfile.features[name];
}

/** AI posture analysis; callers predate isFeatureEnabled, so this stays as a thin alias. */
export function isPostureEnabled(env: Env = process.env): boolean {
  return isFeatureEnabled('posture', env);
}
