import {test,expect} from '@playwright/test';

// Quality-lane privacy and location precision regressions. Synthetic locations
// only; these tests must not call a real geocoding provider.
const location=(label:string,lat:number)=>({
 label,latitude:lat,longitude:-0.14,postcode:'SW1A 1AA',
 precision:'address' as const,country:'GB'
});

test('Address suggestions cannot silently select the first property when ambiguous',async({page})=>{
 await page.route('**/api/address/search',async route=>{
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   suggestions:[location('1 Example Street, London',51.5),location('2 Example Street, London',51.501)]
  })});
 });
 await page.goto('/services');
 await page.getByLabel('Your postcode or street address').fill('Example Street London');
 await expect(page.getByRole('listbox',{name:'Matching addresses'}).getByRole('option')).toHaveCount(2);
 await page.getByRole('button',{name:'Find address'}).click();
 await expect(page.getByText('Choose your exact address from the suggestions below.')).toBeVisible();
 await expect(page.getByText('Searching near:')).toHaveCount(0);
 await page.getByRole('option',{name:/2 Example Street/}).click();
 await expect(page.getByRole('status').filter({hasText:'Searching near:'})).toContainText('2 Example Street');
 await expect(page.getByLabel('Sort results')).toHaveValue('recommended');
});

test('Editing an accepted address immediately clears stale proximity selection',async({page})=>{
 await page.route('**/api/address/search',async route=>{
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   suggestions:[location('1 Example Street, London',51.5)]
  })});
 });
 await page.goto('/services');
 const input=page.getByLabel('Your postcode or street address');
 await input.fill('Example Street London');
 await page.getByRole('option',{name:/1 Example Street/}).click();
 await expect(page.getByLabel('Sort results')).toHaveValue('recommended');
 await input.fill('Another Street London');
 await expect(page.getByText('Searching near:')).toHaveCount(0);
 await expect(page.getByLabel('Sort results')).toHaveValue('quality');
 expect(new URL(page.url()).searchParams.has('address')).toBe(false);
 expect(page.url()).not.toContain('Example%20Street');
});

test('Address lookup uses POST rather than exposing property input in URL',async({page})=>{
 const seen:{method:string;url:string;body:string|null}[]=[];
 await page.route('**/api/address/search',async route=>{
  seen.push({method:route.request().method(),url:route.request().url(),body:route.request().postData()});
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({suggestions:[]})});
 });
 await page.goto('/services');
 await page.getByLabel('Your postcode or street address').fill('10 Example Street London');
 await expect.poll(()=>seen.length).toBeGreaterThan(0);
 expect(seen.every(item=>item.method==='POST')).toBe(true);
 expect(seen.every(item=>!item.url.includes('Example'))).toBe(true);
 expect(seen.some(item=>item.body?.includes('10 Example Street London'))).toBe(true);
 expect(page.url()).not.toContain('Example');
});
