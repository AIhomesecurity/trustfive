import {expect,test} from '@playwright/test';

/** Phase 6: asynchronous failure handling. All network responses are stubbed;
 * no live Supabase project or customer identity is used. */

test('Rapid repeated reset requests result in a single password recovery call',async({page})=>{
 let calls=0;
 await page.route('**/auth/v1/recover*',async route=>{
  calls++;
  await new Promise(resolve=>setTimeout(resolve,250));
  await route.fulfill({status:200,contentType:'application/json',body:'{}'});
 });
 await page.goto('/account/reset');
 await page.getByLabel('Email address').fill('customer@example.com');
 // Dispatch two activation events in the same tick: a disabled button alone
 // cannot protect against a stale React `busy` value in that window.
 await page.getByRole('button',{name:'Email reset link'}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});
 await expect(page.getByRole('status')).toBeVisible();
 expect(calls,'Duplicate reset requests must be suppressed').toBe(1);
});

test('Coverage catalogue failure is reported honestly and disables registration',async({page})=>{
 await page.route('**/rest/v1/trades*',async route=>{
  await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'coverage catalogue temporarily unavailable'})});
 });
 await page.goto('/coverage');
 // The provider error may surface its own message; the essential behaviour is
 // an honest failure notice rather than an empty or invented catalogue.
 await expect(page.getByRole('status')).toContainText(/Unable to load coverage requests|coverage catalogue temporarily unavailable/);
 await expect(page.getByRole('button',{name:'Register pending area interest'})).toBeDisabled();
 // No trade options are fabricated when the catalogue cannot be read.
 await expect(page.getByRole('combobox',{name:'Trade or service'})).toHaveCount(0);
});

test('An invalid or expired session cookie cannot reach a protected page',async({page})=>{
 await page.context().addCookies([{
  name:'sb-placeholder-auth-token',
  value:'not-a-valid-session',
  url:'http://127.0.0.1:3112'
 }]);
 await page.goto('/jobs');
 await expect(page).toHaveURL(/\/account\?next=%2Fjobs/);
 await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
});

test('Address provider failure leaves no selected job-site location',async({page})=>{
 await page.route('**/api/address/search',async route=>{
  await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({suggestions:[],message:'Address lookup is temporarily unavailable'})});
 });
 await page.goto('/services');
 await page.getByLabel('Your postcode or street address').fill('SW1A 1AA');
 await expect(page.getByText('Address lookup is temporarily unavailable')).toBeVisible();
 await expect(page.getByRole('listbox',{name:'Matching addresses'})).toHaveCount(0);
 await expect(page.getByText('Searching near:')).toHaveCount(0);
});

test('Refreshing an anonymous protected journey keeps the requested destination',async({page})=>{
 const destination='/jobs?trade=plumbing&area=test-area';
 await page.goto(destination);
 await expect(page).toHaveURL(/\/account\?next=/);
 const first=new URL(page.url()).searchParams.get('next');
 expect(first).toBe(destination);
 await page.reload();
 await expect(page).toHaveURL(/\/account\?next=/);
 expect(new URL(page.url()).searchParams.get('next')).toBe(destination);
});
