import { expect, test, type Page } from '@playwright/test';
import { activeFeatures, login, uniqueName, waitLoaded } from './helpers';

// H8: no page may scroll sideways on a narrow phone. Pixel 7 (412px) hides problems that a 360px phone shows,
// so each page is checked at the two most common narrow widths. Long "English / मराठी" labels are the usual cause.
const WIDTHS = [360, 390];

/** Elements that stick out past the right edge and aren't inside a scroll/clip box — the ones to fix. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const clipped = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'hidden' || o === 'auto' || o === 'scroll' || o === 'clip') return true;
      }
      return false;
    };
    const offenders = [...document.body.querySelectorAll('*')]
      .filter((el) => el.getBoundingClientRect().right > vw + 1 && !clipped(el))
      .filter((el, _, all) => !all.some((other) => other !== el && el.contains(other)))
      .slice(0, 10)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} "${(el.textContent ?? '').trim().slice(0, 40)}"`);
    return { scrollWidth: document.documentElement.scrollWidth, vw, offenders };
  });
}

async function expectFits(page: Page, label: string) {
  const result = await overflow(page);
  // Soft, so one run lists every page that overflows rather than stopping at the first.
  expect.soft(result.scrollWidth, `${label} scrolls sideways; sticking out: ${result.offenders.join(' | ')}`).toBeLessThanOrEqual(result.vw);
}

test('every main page fits a narrow phone without sideways scrolling', async ({ page, browser }) => {
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

  const pages = () => [
    '/dashboard',
    '/patients',
    '/patients/new',
    `${clientUrl}?tab=overview`,
    `${clientUrl}?tab=treatment`,
    `${clientUrl}?tab=documents`,
    ...(activeFeatures.fees ? [`${clientUrl}?tab=fees`] : []),
    `${clientUrl}?tab=assessment`,
    `${clientUrl}/edit`,
    `${clientUrl}/print`,
    ...(activeFeatures.fees ? [`${clientUrl}/receipt`] : []),
    '/calendar',
    '/settings',
  ];

  for (const width of WIDTHS) {
    await test.step(`${width}px: signed-in pages`, async () => {
      await page.setViewportSize({ width, height: 800 });
      for (const url of pages()) {
        await page.goto(url);
        await waitLoaded(page);
        await expectFits(page, `${url} at ${width}px`);
      }
    });

    await test.step(`${width}px: login and the client's share page`, async () => {
      const client = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });
      const anon = await client.newPage();
      for (const url of ['/login', ...(shareUrl ? [shareUrl] : [])]) {
        await anon.goto(url);
        await expectFits(anon, `${url.startsWith('/s/') ? 'share page' : url} at ${width}px`);
      }
      await client.close();
    });
  }

  await test.step('clean up', async () => {
    await page.goto(`${clientUrl}/edit`);
    await page.getByLabel(`Type "${name}" to confirm`).fill(name);
    await page.getByRole('button', { name: 'Delete client permanently' }).click();
    await page.waitForURL(/\/patients$/);
  });
});
