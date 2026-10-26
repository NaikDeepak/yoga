import { expect, type Page } from '@playwright/test';
import { CLINIC_REGISTRY } from '../src/clinics';
import { MOCK_PASSWORD, MOCK_USER } from '../src/lib/local-mock';

export async function login(page: Page) {
  await page.goto('/login');
  await page.locator('input[name=email]').fill(MOCK_USER.email);
  await page.locator('input[name=password]').fill(MOCK_PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/dashboard');
}

/** Client pages stream in behind a bilingual "Loading..." placeholder; wait until it is gone. */
export async function waitLoaded(page: Page) {
  await expect(page.getByText('Loading...')).toHaveCount(0, { timeout: 120_000 });
}

/** `.local-db/` survives between local runs, so every run makes its own client. */
export function uniqueName() {
  return `E2E Client ${Date.now()}`;
}

/** The clinic profile the main e2e server runs (`CLINIC_PROFILE`, unset = pawar; see playwright.config.ts). */
export const PROFILE_SLUG = process.env.CLINIC_PROFILE || 'pawar';
export const activeProfile = CLINIC_REGISTRY[PROFILE_SLUG];
if (!activeProfile) throw new Error(`e2e: unknown CLINIC_PROFILE "${PROFILE_SLUG}"`);
/** Module switches the active profile has on; steps for a module that is off are skipped. */
export const activeFeatures = activeProfile.features;
