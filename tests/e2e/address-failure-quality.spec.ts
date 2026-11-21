import {test,expect} from '@playwright/test';

/** Independent quality-lane regression checks: no fabricated locations or silent
 * selection after provider failure, stale suggestions, or filter reset. */
test('Address provider outage does not invent a nearby match',async({page})=>{
 await page.route('**/api/address/search',async route=>{
  await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({
   suggestions:[],message:'Address lookup is temporarily unavailable'
  })});
 });
 await page.goto('/services');
 const input=page.getByLabel('Your postcode or street address');
 await input.fill('SW1A 1AA');
 await expect(page.getByText('Address lookup is temporarily unavailable')).toBeVisible();
 await expect(page.getByRole('option')).toHaveCount(0);
 await expect(page.getByText('Searching near:')).toHaveCount(0);
 await expect(page.getByLabel('Sort results')).not.toHaveValue('recommended');
});

test('Clearing directory filters removes selected address and proximity sort',async({page})=>{
 await page.route('**/api/address/search',async route=>{
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   suggestions:[{label:'SW1A 1AA, Westminster, United Kingdom',latitude:51.501,
    longitude:-0.142,postcode:'SW1A 1AA',precision:'postcode',country:'GB'}]
  })});
 });
 await page.goto('/services?trade=plumbing');
 await page.getByLabel('Your postcode or street address').fill('SW1A 1AA');
 await page.getByRole('option',{name:/SW1A 1AA/}).click();
 await expect(page.getByLabel('Sort results')).toHaveValue('recommended');
 await page.getByRole('button',{name:'Clear filters'}).click();
 await expect(page).toHaveURL(/\/services$/);
 await expect(page.getByLabel('Your postcode or street address')).toHaveValue('');
 await expect(page.getByText('Searching near:')).toHaveCount(0);
 await expect(page.getByLabel('Sort results')).toHaveValue('quality');
});

test('Address endpoint rejects oversized, non-string and malformed payloads',async({request})=>{
 for(const data of [{query:'X'.repeat(161)},{query:123},{query:null},{}]){
  const response=await request.post('/api/address/search',{data});
  expect(response.status()).toBe(400);
  const body=await response.json() as {suggestions:unknown[];message:string};
  expect(body.suggestions).toEqual([]);
  expect(body.message).toBeTruthy();
  expect(response.headers()['cache-control']).toContain('no-store');
 }
 const malformed=await request.post('/api/address/search',{
  headers:{'Content-Type':'application/json'},data:'{invalid-json'
 });
 expect(malformed.status()).toBe(400);
 expect((await malformed.json()).suggestions).toEqual([]);
});
