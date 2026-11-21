import { expect, test } from '@playwright/test';

// Opt-in, read-only acceptance using a real customer-owned staging session.
// Keep the storage state outside the repository and never print its contents.
const storageState = process.env.TRUSTFIVE_CUSTOMER_STORAGE_STATE;
const enabled = process.env.TRUSTFIVE_STAGING_ACCEPTANCE === '1' && Boolean(storageState);

// Customer jobs and quotes may contain private addresses and correspondence.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('authorised customer quote review staging acceptance', () => {
  test.skip(!enabled, 'Requires explicit staging opt-in and an authorised customer session');

  test('quote review is read-only until the customer explicitly confirms', async ({ browser, baseURL }) => {
    if (!storageState) throw new Error('Authorised customer storage state missing');
    const context = await browser.newContext({ baseURL, storageState });
    try {
      const page = await context.newPage();
      await page.goto('/jobs');
      await expect(page.getByRole('heading', { name: 'My jobs and quotes' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Post a job' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Publish job request' })).toBeDisabled();

      // Opening a quote confirmation must not itself accept a quote or create a booking.
      const review = page.getByRole('button', { name: 'Review and accept quote' }).first();
      if (await review.count()) {
        await review.click();
        await expect(page.getByRole('group', { name: /Confirm quote from/ })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Confirm and create booking' })).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(page.getByRole('button', { name: 'Confirm and create booking' })).toHaveCount(0);
      }
      // Never submit the job, confirm a quote, or mutate staging records.
    } finally {
      await context.close();
    }
  });
});
