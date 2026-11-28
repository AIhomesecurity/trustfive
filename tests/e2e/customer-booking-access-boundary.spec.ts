import { expect, test } from '@playwright/test';

// Anonymous negative-access checks are safe to run against an empty staging
// marketplace. They do not create accounts, jobs, quotes, or bookings.
// Authenticated acceptance is a separate, opt-in test with authorised users.
const protectedDestinations = [
  '/jobs',
  '/bookings',
  '/messages',
] as const;

for (const destination of protectedDestinations) {
  test(`anonymous visitors cannot access ${destination} directly`, async ({ page }) => {
    await page.goto(destination);
    await expect(page).toHaveURL(/\/account\?next=/);
    const redirect = new URL(page.url());
    expect(redirect.pathname).toBe('/account');
    expect(redirect.searchParams.get('next')).toBe(destination);
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  });
}

test('anonymous customer cannot bypass job authentication using encoded return parameters', async ({ page }) => {
  const destination = '/jobs?trade=cctv-installation&area=unverified-area';
  await page.goto(destination);
  await expect(page).toHaveURL(/\/account\?next=/);
  const next = new URL(page.url()).searchParams.get('next');
  expect(next).toBe(destination);
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  // A query-string area is not evidence of independently reviewed coverage.
  // No job submission or professional approval is attempted here.
});
