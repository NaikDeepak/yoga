import { expect, test, type Page } from '@playwright/test';
import { login, uniqueName, waitLoaded } from './helpers';

// Runs against the second dev server (port 3101, playwright.config.ts) where every module switch is off:
// posture, flexibility, AI, share links, check-ins, fees. The app must still work, with those parts gone.

async function noErrorScreen(page: Page) {
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
}

async function noModuleUi(page: Page) {
  await expect(page.getByText('Generate with AI')).toHaveCount(0);
  await expect(page.getByText('Share with client', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Share progress', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Fees', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Add posture assessment')).toHaveCount(0);
  await expect(page.getByText('Add flexibility tests')).toHaveCount(0);
  await noErrorScreen(page);
}

test('every page works with every module switched off', async ({ page }) => {
  const name = uniqueName();
  let clientUrl = '';

  await test.step('log in and add a client', async () => {
    await login(page);
    await page.goto('/patients/new');
    await page.getByLabel('Full Name *').fill(name);
    await page.getByLabel('Mobile *').fill('9876543210');
    await page.getByRole('button', { name: 'New Client' }).click();
    await page.waitForURL(/\/patients\/[0-9a-f-]{36}$/);
    clientUrl = new URL(page.url()).pathname;
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await noModuleUi(page);
  });

  await test.step('client tabs', async () => {
    for (const tab of ['overview', 'treatment', 'documents', 'assessment']) {
      await page.goto(`${clientUrl}?tab=${tab}`);
      await waitLoaded(page);
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
      if (tab === 'treatment') await expect(page.getByRole('button', { name: 'Add visit' })).toBeVisible();
      if (tab === 'documents') await expect(page.getByRole('button', { name: 'Upload' })).toBeVisible();
      if (tab === 'assessment') await expect(page.getByText('Primary Concern').first()).toBeVisible();
      await noModuleUi(page);
    }
  });

  await test.step('the fees tab is gone: ?tab=fees shows the overview', async () => {
    await page.goto(`${clientUrl}?tab=fees`);
    await waitLoaded(page);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(page.getByLabel('Total Course Fee (₹)')).toHaveCount(0);
    await expect(page.getByText('Personal').first()).toBeVisible();
    await noModuleUi(page);
  });

  await test.step('receipts are 404', async () => {
    // The page streams behind loading.tsx, so the HTTP status is already 200 when notFound() fires; the not-found screen is the proof.
    await page.goto(`${clientUrl}/receipt`);
    await expect(page.getByRole('heading', { name: 'Page not found' }).first()).toBeVisible();
    await expect(page.getByText('Payment Receipt')).toHaveCount(0);
    await noErrorScreen(page);
  });

  await test.step('posture pages are 404', async () => {
    await page.goto(`${clientUrl}/posture/new`);
    await expect(page.getByRole('heading', { name: 'Page not found' }).first()).toBeVisible();
    await noErrorScreen(page);
  });

  await test.step('calendar, settings, dashboard, client list', async () => {
    await page.goto('/calendar');
    await waitLoaded(page);
    await expect(page.getByRole('heading', { name: 'Calendar' }).first()).toBeVisible();
    await noModuleUi(page);

    await page.goto('/settings');
    await waitLoaded(page);
    await expect(page.getByRole('heading', { name: 'Settings' }).first()).toBeVisible();
    await noModuleUi(page);

    await page.goto('/dashboard');
    await waitLoaded(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' }).first()).toBeVisible();
    await expect(page.getByText('Visits This Month').first()).toBeVisible();
    await expect(page.getByText('Quiet clients')).toHaveCount(0);
    await noModuleUi(page);

    await page.goto('/patients');
    await expect(page.getByText(name).first()).toBeVisible();
    await noModuleUi(page);
  });
});
