import {test,expect} from '@playwright/test';

test('editing an address clears previous suggestions before a new provider response',async({page})=>{
 let releaseSecond:()=>void=()=>{};
 const waitForSecond=new Promise<void>(resolve=>{releaseSecond=resolve;});
 await page.route('**/api/address/search',async route=>{
  const request=route.request().postDataJSON() as {query:string};
  if(request.query.includes('Second'))await waitForSecond;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({suggestions:[{
   label:request.query.includes('Second')?'20 Second Street, London':'10 First Street, London',
   latitude:51.5,longitude:-0.1,postcode:'SW1A 1AA',precision:'address',country:'GB'
  }]})}).catch(()=>{});
 });
 await page.goto('/services');
 const input=page.getByLabel('Your postcode or street address');
 await input.fill('First Street London');
 await expect(page.getByRole('option',{name:/10 First Street/})).toBeVisible();
 await input.fill('Second Street London');
 // The old result must disappear synchronously, before the debounce/network round-trip.
 await expect(page.getByRole('option',{name:/10 First Street/})).toHaveCount(0);
 await expect(page.getByText('Searching near:')).toHaveCount(0);
 await page.getByRole('button',{name:'Find address'}).click();
 await expect(page.getByText('Searching near:')).toHaveCount(0);
 releaseSecond();
 await expect(page.getByRole('option',{name:/20 Second Street/})).toBeVisible();
 await page.getByRole('option',{name:/20 Second Street/}).click();
 await expect(page.getByRole('status').filter({hasText:'Searching near:'})).toContainText('20 Second Street');
});
