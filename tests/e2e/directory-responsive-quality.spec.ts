import { expect, test } from '@playwright/test';

// Independent quality lane: directory usability without creating fake providers.
for (const width of [320, 375, 768, 1280]) {
  test(`Professional directory remains usable at ${width}px without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/services?trade=plumbing');
    await expect(page.getByRole('heading', { name: 'Find a TrustFive professional' })).toBeVisible();
    await expect(page.getByLabel('Trade or service')).toBeVisible();
    await expect(page.getByLabel('Your postcode or street address')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Describe your job' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Unexpected horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
  });
}

test('Directory filters can be cleared using keyboard alone', async ({ page }) => {
  await page.goto('/services?trade=plumbing');
  const clear = page.getByRole('button', { name: 'Clear filters' });
  await clear.focus();
  await expect(clear).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/services$/);
  await expect(page.getByLabel('Trade or service')).toBeVisible();
});
