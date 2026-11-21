import { expect, test } from '@playwright/test';

// Quality lane: public discovery must treat unknown search terms as untrusted text.
// No fixture providers or approval changes are needed for this test.
test('Unknown service query is displayed as text, not executable markup', async ({ page }) => {
  const injected = '<img src=x onerror=alert(1)>';
  let dialogs = 0;
  page.on('dialog', dialog => { dialogs++; void dialog.dismiss(); });
  await page.goto('/services?q=' + encodeURIComponent(injected));
  await expect(page.getByRole('heading', { name: 'Find a TrustFive professional' })).toBeVisible();
  const hint = page.getByRole('status').filter({ hasText: 'No exact category for' });
  await expect(hint).toContainText(injected);
  await expect(hint.locator('img')).toHaveCount(0);
  expect(dialogs).toBe(0);
  await expect(page.getByLabel('Trade or service')).toHaveValue('');
  await expect(page.getByRole('link', { name: 'Describe your job' })).toBeVisible();
});
