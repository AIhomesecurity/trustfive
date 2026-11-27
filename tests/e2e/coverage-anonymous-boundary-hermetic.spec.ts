import {expect,test} from '@playwright/test';

/**
 * Regression for the unstable coverage boundary test. The sign-in guidance is
 * static anonymous copy and must not depend on a Supabase auth round trip.
 * The trades request is deliberately delayed by three seconds so `loading`
 * stays true: supabase-js `getUser()` short-circuits when there is no stored
 * session, so delaying auth alone would not reproduce the failure. The old
 * `!loading && !signedIn` condition therefore cannot pass by accident. Both
 * responses are stubbed, so no live service is involved.
 */
test('anonymous coverage sign-in copy renders while trades are still pending',async({page})=>{
 await page.route('**/auth/v1/user*',async route=>{
  await route.fulfill({status:200,contentType:'application/json',body:'{"user":null}'});
 });
 await page.route('**/rest/v1/trades*',async route=>{
  await new Promise(resolve=>setTimeout(resolve,3000));
  await route.fulfill({status:200,contentType:'application/json',body:'[]'});
 });

 await page.goto('/coverage');
 await expect(page.getByRole('link',{name:/go to your account/i}))
  .toHaveAttribute('href','/account?next=%2Fcoverage',{timeout:1000});
 await expect(page.getByRole('button',{name:/register pending area interest/i})).toBeDisabled();
 await expect(page.getByText(/we store the postcode district only/i)).toBeVisible({timeout:1000});
 expect(page.url()).not.toMatch(/postcode=|address=|latitude=|longitude=/i);
});
