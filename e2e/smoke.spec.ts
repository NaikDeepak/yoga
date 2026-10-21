import { expect, test } from '@playwright/test';
import { login, uniqueName, waitLoaded } from './helpers';

// One happy path through the main areas, in the order the clinic uses them. Steps share one client,
// so this is a single test with steps rather than independent tests.
test('client lifecycle: add → visit → fee + receipt → exercises → share → withdraw → delete', async ({ page, browser }) => {
  const name = uniqueName();
  let clientUrl = '';
  let shareUrl = '';

  await test.step('log in', async () => {
    await login(page);
  });

  await test.step('add a client', async () => {
    await page.goto('/patients/new');
    await page.getByLabel('Full Name *').fill(name);
    await page.getByLabel('Mobile *').fill('9876543210');
    await page.getByRole('button', { name: 'New Client' }).click();
    await page.waitForURL(/\/patients\/[0-9a-f-]{36}$/);
    clientUrl = new URL(page.url()).pathname;
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  });

  await test.step('log a visit', async () => {
    await page.goto(`${clientUrl}?tab=treatment`);
    await waitLoaded(page);
    const visit = page.getByRole('group').filter({ has: page.getByRole('button', { name: 'Add visit' }) });
    await visit.getByRole('radio', { name: '5', exact: true }).check();
    await visit.getByLabel('Progress note').fill('E2E visit');
    await visit.getByRole('button', { name: 'Add visit' }).click();
    await expect(page.getByText('No visits yet')).toHaveCount(0);
    await expect(page.getByRole('listitem').getByText('E2E visit')).toBeVisible();
  });

  await test.step('set a course fee, record a payment, open the receipt', async () => {
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

    await page.goto(`${clientUrl}/receipt`);
    await expect(page.getByText('Payment Receipt')).toBeVisible();
    await expect(page.getByRole('main').getByText(name)).toBeVisible();
    await expect(page.getByRole('main').getByText('1,000').first()).toBeVisible();
  });

  await test.step('prescribe an exercise', async () => {
    await page.goto(`${clientUrl}?tab=treatment`);
    await waitLoaded(page);
    await page.getByRole('checkbox', { name: 'Plank', exact: true }).check();
    await page.getByRole('button', { name: 'Save Exercises' }).click();
    await expect(page.getByRole('button', { name: 'Share with client' })).toBeVisible();
  });

  await test.step('share the exercises; the link opens without a login', async () => {
    await page.getByRole('button', { name: 'Share with client' }).click();
    const link = page.locator('input[readonly][value*="/s/"]');
    await expect(link).toBeVisible();
    shareUrl = new URL(await link.inputValue()).pathname;

    const client = await browser.newContext(); // no session cookie: what the client sees
    const shared = await client.newPage();
    await shared.goto(shareUrl);
    await expect(shared.getByRole('heading', { name: '1. Plank' })).toBeVisible();
    await client.close();
  });

  await test.step('stop sharing; the link stops working', async () => {
    await page.getByRole('button', { name: 'Stop sharing' }).click();
    await expect(page.getByRole('button', { name: 'Stop sharing' })).toHaveCount(0);

    const client = await browser.newContext();
    const shared = await client.newPage();
    await shared.goto(shareUrl);
    await expect(shared.getByRole('heading', { name: 'This link has expired' })).toBeVisible();
    await client.close();
  });

  await test.step('delete the client', async () => {
    await page.goto(`${clientUrl}/edit`);
    const button = page.getByRole('button', { name: 'Delete client permanently' });
    await expect(button).toBeDisabled();
    await page.getByLabel(`Type "${name}" to confirm`).fill(name);
    await button.click();
    await page.waitForURL(/\/patients$/);

    // Positive check: the client page itself is gone, not just still loading.
    await page.goto(clientUrl);
    await expect(page.getByRole('heading', { name: 'Page not found' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name })).toHaveCount(0);
  });
});
