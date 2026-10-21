import { expect, type Page } from '@playwright/test';
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
