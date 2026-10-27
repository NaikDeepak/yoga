// Per-clinic login settings for the clinic scripts (create-login, login-smoke), kept outside the repo
// in ~/.config/clinics/<slug>.env, chmod 600. Holds no passwords: the scripts ask for them.
// Error messages name keys, never values.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'dotenv';

export interface ClinicLoginConfig {
  authBaseUrl: string;
  adminEmail: string;
  siteUrl: string;
  /** Optional: Vercel "Protection Bypass for Automation" secret, for smoke-testing preview URLs. */
  vercelProtectionBypass?: string;
}

export const CLINIC_CONFIG_DIR = join(homedir(), '.config', 'clinics');
const REQUIRED = ['NEON_AUTH_BASE_URL', 'ADMIN_EMAIL', 'SITE_URL'] as const;
const trimSlash = (url: string) => url.replace(/\/+$/, '');

/** The clinic's settings file, parsed, after checking that only its owner can read it. */
function readClinicFile(slug: string, dir: string, keys: readonly string[]): { file: string; values: Record<string, string> } {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error('clinic slug must be lowercase letters, digits and dashes');
  const file = join(dir, `${slug}.env`);
  if (!existsSync(file)) throw new Error(`${file} not found (keys: ${keys.join(', ')}; chmod 600)`);
  if ((statSync(file).mode & 0o077) !== 0) throw new Error(`${file} is readable by other users; run: chmod 600 ${file}`);
  return { file, values: parse(readFileSync(file)) };
}

export function readClinicLoginConfig(slug: string, dir = CLINIC_CONFIG_DIR): ClinicLoginConfig {
  const { file, values } = readClinicFile(slug, dir, REQUIRED);
  for (const key of REQUIRED) {
    if (!values[key]?.trim()) throw new Error(`${file} is missing ${key}`);
  }
  return {
    authBaseUrl: trimSlash(values.NEON_AUTH_BASE_URL.trim()),
    adminEmail: values.ADMIN_EMAIL.trim().toLowerCase(),
    siteUrl: trimSlash(values.SITE_URL.trim()),
    vercelProtectionBypass: values.VERCEL_PROTECTION_BYPASS?.trim() || undefined,
  };
}

/** One optional secret from the clinic's settings file (e.g. CRON_SECRET for deploy:prod); undefined when unset. */
export function readClinicSecret(slug: string, key: string, dir = CLINIC_CONFIG_DIR): string | undefined {
  return readClinicFile(slug, dir, [key]).values[key]?.trim() || undefined;
}
