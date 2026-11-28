import { expect, test } from '@playwright/test';

// This acceptance slice requires a REAL, consented customer session.
// Store the Playwright state outside the repository. Never log its contents.
// The suite is deliberately read-only and skips unless explicitly enabled.
const storageState = process.env.TRUSTFIVE_CUSTOMER_STORAGE_STATE;
const enabled = process.env.TRUSTFIVE_STAGING_ACCEPTANCE === '1' && Boolean(storageState);

// Authenticated pages can contain private messages, names and addresses.
// Do not persist browser recordings or failure screenshots.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('authorised customer messages staging acceptance', () => {
  test.skip(!enabled, 'Requires explicit staging opt-in and an authorised customer session');

  test('messages route does not disclose a customer session through the URL', async ({ browser, baseURL }) => {
    if (!storageState) throw new Error('Authorised customer storage state missing');
    const context = await browser.newContext({ baseURL, storageState });
    try {
      const page = await context.newPage();
      await page.goto('/messages');
      await expect(page).toHaveURL(/\/messages(?:[?#]|$)/);
      const current = new URL(page.url());
      // Customer authentication and private message contents must never be
      // encoded into shareable query strings or fragments.
      expect(current.search).toBe('');
      expect(current.hash).toBe('');
      await expect(page.locator('body')).not.toContainText('Sign in to view your messages.');
      // Do not send messages, open attachments or change read status.
    } finally {
      await context.close();
    }
  });
});
