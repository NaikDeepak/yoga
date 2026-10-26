import { expect, test, type Locator, type Page } from '@playwright/test';
import { FORBIDDEN } from '../tests/helpers/pawar-identity';
import { activeFeatures, activeProfile, login, PROFILE_SLUG, uniqueName, waitLoaded } from './helpers';

// A deploy for any clinic other than Pawar must show nothing of Pawar's: no name, number, address, logo, icon or
// colour on any screen a clinic user or client can reach. Runs only when CLINIC_PROFILE is not pawar
// (`CLINIC_PROFILE=sunrise npm run e2e`); the pawar run skips it.
test.skip(PROFILE_SLUG === 'pawar', 'identity check is for non-Pawar clinic profiles');

// The profile's own asset paths may legitimately contain a forbidden fragment (e.g. `/icons/`); strip them first.
const ownAssets = [activeProfile.logo.src, ...Object.values(activeProfile.icons)];
function withoutOwnAssets(text: string) {
  return ownAssets.reduce((out, asset) => out.split(asset).join(''), text);
}

function expectNoPawar(where: string, haystack: string) {
  const lower = withoutOwnAssets(haystack).toLowerCase();
  const found = FORBIDDEN.filter((term) => lower.includes(term.toLowerCase()));
  expect.soft(found, `${where} shows Pawar identity`).toEqual([]);
}

async function checkPage(page: Page, where: string, anchor: Locator) {
  // The anchor only renders once the page is really there, so a blank or error page cannot pass the absence check.
  await expect(anchor, `${where}: page did not load`).toBeVisible();
  await waitLoaded(page);
  const seen = await page.evaluate(() => ({
    text: document.body.innerText,
    imgs: [...document.querySelectorAll('img[src]')].map((img) => img.getAttribute('src') ?? ''),
    primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim().toLowerCase(),
  }));
  expectNoPawar(`${where} text`, seen.text);
  expectNoPawar(`${where} images`, seen.imgs.join('\n'));
  expect.soft(seen.primary, `${where} --primary`).toBe(activeProfile.theme.primary.toLowerCase());
}

test('nothing of the Pawar clinic shows on any screen', async ({ page, browser, request }) => {
  const name = uniqueName();
  let clientUrl = '';
  let shareUrl = '';

  await test.step('set up a client with a visit, a fee and a shared exercise', async () => {
    await login(page);
    await page.goto('/patients/new');
    await page.getByLabel('Full Name *').fill(name);
    await page.getByLabel('Mobile *').fill('9876543210');
    await page.getByRole('button', { name: 'New Client' }).click();
    await page.waitForURL(/\/patients\/[0-9a-f-]{36}$/);
    clientUrl = new URL(page.url()).pathname;

    if (activeFeatures.fees) {
      await page.goto(`${clientUrl}?tab=fees`);
      await waitLoaded(page);
      await page.getByLabel('Total Course Fee (₹)').fill('3000');
      await page.getByRole('button', { name: 'Set', exact: true }).click();
      await expect(page.getByText('₹3,000').first()).toBeVisible();
      const payment = page.getByRole('group').filter({ has: page.getByRole('button', { name: 'Add', exact: true }) });
      await payment.getByLabel('Amount (₹)').fill('1000');
      await payment.getByLabel('Date').fill('2026-10-21');
      await payment.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(page.getByText('No payments recorded')).toHaveCount(0);
    }

    await page.goto(`${clientUrl}?tab=treatment`);
    await waitLoaded(page);
    await page.getByRole('checkbox', { name: 'Plank', exact: true }).check();
    await page.getByRole('button', { name: 'Save Exercises' }).click();
    if (activeFeatures.shareLinks) {
      await page.getByRole('button', { name: 'Share with client' }).click();
      const link = page.locator('input[readonly][value*="/s/"]');
      await expect(link).toBeVisible();
      shareUrl = new URL(await link.inputValue()).pathname;
    }
  });

  await test.step('login page', async () => {
    const anon = await browser.newContext();
    const loginPage = await anon.newPage();
    await loginPage.goto('/login');
    await checkPage(loginPage, 'login', loginPage.locator('input[name=email]'));
    await anon.close();
  });

  await test.step('dashboard and client list', async () => {
    await page.goto('/dashboard');
    await checkPage(page, 'dashboard', page.getByRole('heading', { level: 1 }));
    await page.goto('/patients');
    await checkPage(page, 'client list', page.getByText(name).first());
  });

  await test.step('every client tab the profile has on', async () => {
    const tabs = ['overview', 'treatment', 'documents', 'assessment', ...(activeFeatures.fees ? ['fees'] : [])];
    for (const tab of tabs) {
      await page.goto(`${clientUrl}?tab=${tab}`);
      await waitLoaded(page);
      await checkPage(page, `client tab ${tab}`, page.getByRole('heading', { level: 1, name }));
    }
  });

  await test.step('print page', async () => {
    await page.goto(`${clientUrl}/print`);
    await waitLoaded(page);
    await checkPage(page, 'print page', page.getByText(name).first());
  });

  if (activeFeatures.fees) {
    await test.step('receipt', async () => {
      await page.goto(`${clientUrl}/receipt`);
      await checkPage(page, 'receipt', page.getByText('Payment Receipt'));
    });
  }

  if (activeFeatures.shareLinks) {
    await test.step("the client's share page (no login)", async () => {
      const anon = await browser.newContext();
      const shared = await anon.newPage();
      await shared.goto(shareUrl);
      await checkPage(shared, 'share page', shared.getByRole('heading', { name: '1. Plank' }));
      await anon.close();
    });
  }

  await test.step('web app manifest', async () => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBe(true);
    const text = await res.text();
    expect(JSON.parse(text).name, 'manifest name').toBe(activeProfile.appName ?? activeProfile.name.en);
    expectNoPawar('manifest', text);
  });

  await test.step('clean up', async () => {
    await page.goto(`${clientUrl}/edit`);
    await page.getByLabel(`Type "${name}" to confirm`).fill(name);
    await page.getByRole('button', { name: 'Delete client permanently' }).click();
    await page.waitForURL(/\/patients$/);
  });
});
