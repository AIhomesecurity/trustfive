import { expect, test } from '@playwright/test';

// Opt-in acceptance for a REAL, consented staging customer session.
// Create the Playwright storage-state file outside the repository, keep it
// private, and set TRUSTFIVE_CUSTOMER_STORAGE_STATE to its absolute path.
// No credentials, fake customers, jobs or professional approvals are created.
// Without an authorised session the test is explicitly skipped, not passed.
const storageState = process.env.TRUSTFIVE_CUSTOMER_STORAGE_STATE;
const acceptanceEnabled = Boolean(storageState && process.env.TRUSTFIVE_STAGING_ACCEPTANCE === '1');

test.describe('authorised customer read-only staging acceptance', () => {
  // Authenticated pages may contain private addresses and session cookies.
  // Never retain traces, screenshots or videos for these opt-in tests.
  test.use({ trace: 'off', screenshot: 'off', video: 'off' });
  test.skip(!acceptanceEnabled, 'Requires opt-in and an existing authorised staging customer session');

  test('customer can open their job workspace without publishing a job', async ({ browser, baseURL }) => {
    if (!storageState) throw new Error('Missing authorised customer storage state');
    const context = await browser.newContext({ storageState, baseURL });
    try {
      const page = await context.newPage();
      await page.goto('/jobs');
      await expect(page.getByRole('heading', { name: 'My jobs and quotes' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Post a job' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Publish job request' })).toBeDisabled();
      await expect(page.getByText('Sign in to post and manage jobs.')).toHaveCount(0);
      expect(new URL(page.url()).pathname).toBe('/jobs');
      // This deliberately never clicks Publish, approves a professional,
      // or modifies staging data.
    } finally {
      await context.close();
    }
  });

  test('customer booking workspace remains private and read-only', async ({ browser, baseURL }) => {
    if (!storageState) throw new Error('Missing authorised customer storage state');
    const context = await browser.newContext({ storageState, baseURL });
    try {
      const page = await context.newPage();
      await page.goto('/bookings');
      await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible();
      await expect(page.getByText('Sign in to manage your bookings.')).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Sign in to see your bookings' })).toHaveCount(0);
      expect(new URL(page.url()).pathname).toBe('/bookings');
      // No booking state, address-sharing consent, or review is changed.
    } finally {
      await context.close();
    }
  });
});
