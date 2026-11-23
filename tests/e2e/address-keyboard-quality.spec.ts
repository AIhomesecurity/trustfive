import {test,expect} from '@playwright/test';

// Quality lane: keyboard-only address discovery must not guess a property.
// Synthetic results prevent real address-provider calls or customer data exposure.
const property=(number:number)=>({
 label:`${number} Example Street, London`,latitude:51.5+number/10000,
 longitude:-0.14,postcode:'SW1A 1AA',precision:'address',country:'GB'
});

test('Enter never silently selects one of two matching properties',async({page})=>{
 await page.route('**/api/address/search',async route=>{
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   suggestions:[property(1),property(2)]
  })});
 });
 await page.goto('/services');
 const input=page.getByLabel('Your postcode or street address');
 await input.fill('Example Street London');
 const options=page.getByRole('listbox',{name:'Matching addresses'}).getByRole('option');
 await expect(options).toHaveCount(2);
 await input.press('Enter');
 await expect(page.getByText('Choose your exact address from the suggestions below.')).toBeVisible();
 await expect(page.getByText('Searching near:')).toHaveCount(0);
 await expect(page.getByLabel('Sort results')).toHaveValue('quality');
 // The suggestions use arrow navigation and stay out of the tab sequence.
 await input.press('Tab');
 const findAddress=page.getByRole('button',{name:'Find address'});
 await expect(findAddress).toBeFocused();
 await findAddress.press('Tab');
 await expect(page.getByLabel('Sort results')).toBeFocused();
 await input.press('ArrowUp');
 await expect(options.nth(1)).toHaveAttribute('aria-selected','true');
 await input.press('Enter');
 await expect(page.getByRole('status').filter({hasText:'Searching near:'})).toContainText('2 Example Street');
 await expect(page.getByLabel('Sort results')).toHaveValue('recommended');
 expect(page.url()).not.toContain('Example');
});

test('Enter selects a unique address without submitting an unrelated page form',async({page})=>{
 await page.route('**/api/address/search',async route=>{
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   suggestions:[property(3)]
  })});
 });
 await page.goto('/services?trade=plumbing');
 const input=page.getByLabel('Your postcode or street address');
 await input.fill('3 Example Street London');
 await expect(page.getByRole('listbox',{name:'Matching addresses'}).getByRole('option')).toHaveCount(1);
 await input.press('Enter');
 await expect(page.getByRole('status').filter({hasText:'Searching near:'})).toContainText('3 Example Street');
 await expect(page.getByLabel('Sort results')).toHaveValue('recommended');
 await expect(page).toHaveURL(/\/services\?trade=plumbing$/);
});

test('mobile combobox can dismiss and choose an explicit property with the keyboard',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 try{
  const page=await context.newPage();
  await page.route('**/api/address/search',route=>route.fulfill({json:{suggestions:[property(1),property(2)]}}));
  await page.goto('http://127.0.0.1:3112/services');
  const input=page.getByRole('combobox',{name:'Your postcode or street address'});
  await input.fill('Example Street London');
  await expect(input).toHaveAttribute('aria-expanded','true');
  await input.press('ArrowDown');
  await expect(page.getByRole('listbox',{name:'Matching addresses'}).getByRole('option',{selected:true})).toContainText('1 Example Street');
  await input.press('Escape');
  await expect(input).toHaveAttribute('aria-expanded','false');
  await expect(input).toBeFocused();
  await expect(page.getByText('Searching near:')).toHaveCount(0);
  await input.press('ArrowUp');
  await expect(page.getByRole('listbox',{name:'Matching addresses'}).getByRole('option',{selected:true})).toContainText('2 Example Street');
  await input.press('Enter');
  await expect(input).toBeFocused();
  await expect(page.getByRole('status').filter({hasText:'Searching near:'})).toContainText('2 Example Street');
  await expect(page).toHaveURL(/\/services$/);
 }finally{
  await context.close();
 }
});

test('mobile keyboard retries an outage and reopens a dismissed result before choosing it',async({page})=>{
 await page.setViewportSize({width:360,height:740});
 let calls=0;
 await page.route('**/api/address/search',route=>{
  calls++;
  return route.fulfill(calls===1
   ?{status:503,json:{suggestions:[property(9)],message:'Synthetic address outage'}}
   :{json:{suggestions:[property(3)]}});
 });
 await page.goto('/services?q=CCTV');
 const input=page.getByRole('combobox',{name:'Your postcode or street address'});
 const options=page.getByRole('listbox',{name:'Matching addresses'});
 await input.fill('Example Street London');
 await expect(page.getByText('Synthetic address outage')).toBeVisible();
 await expect(options).toHaveCount(0);
 await expect(page.getByText('Searching near:')).toHaveCount(0);
 await page.getByRole('button',{name:'Retry address lookup'}).press('Enter');
 await expect(options.getByRole('option')).toContainText('3 Example Street');

 await expect(input).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(options).toHaveCount(0);
 await input.press('Enter');
 await expect(options.getByRole('option')).toContainText('3 Example Street');
 await expect(page.getByText('Searching near:')).toHaveCount(0);
 await input.press('Enter');
 await expect(page.getByRole('status').filter({hasText:'Searching near:'})).toContainText('3 Example Street');
 await expect(page).toHaveURL(/\/services\?q=CCTV$/);
 expect(calls).toBe(2);
});

test('mobile mixed suggestions describe postcode precision without implying an exact address',async({page})=>{
 await page.setViewportSize({width:360,height:740});
 await page.route('**/api/address/search',route=>route.fulfill({json:{suggestions:[
  property(1),{...property(2),label:'SW1A 1AA',precision:'postcode'},
 ]}}));
 await page.goto('/services?q=CCTV');
 const input=page.getByRole('combobox',{name:'Your postcode or street address'});
 await input.fill('SW1A 1AA');
 await expect(page.getByRole('listbox',{name:'Matching addresses'}).getByRole('option')).toHaveCount(2);
 await input.press('Enter');
 await expect(page.getByText('Choose a location from the suggestions below.')).toBeVisible();
 await input.press('ArrowUp');
 await input.press('Enter');
 await expect(page.getByText('Distance uses an approximate postcode or district centre', {exact:false})).toBeVisible();
 await expect(page).toHaveURL(/\/services\?q=CCTV$/);
});

test('Escape keeps an in-flight mobile address lookup dismissed until reopened',async({page})=>{
 await page.setViewportSize({width:360,height:740});
 let release=()=>{};
 const pending=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/address/search',async route=>{
  await pending;
  await route.fulfill({json:{suggestions:[property(2)]}});
 });
 try{
  await page.goto('/services');
  const input=page.getByRole('combobox',{name:'Your postcode or street address'});
  await input.fill('Example Street');
  await expect(page.getByRole('button',{name:'Finding…'})).toBeVisible();
  await input.press('Escape');
  release();
  await expect(page.getByRole('button',{name:'Find address'})).toBeEnabled();
  await expect(input).toHaveAttribute('aria-expanded','false');
  await input.press('ArrowDown');
  await expect(page.getByRole('option',{selected:true,name:/2 Example Street/})).toBeVisible();
  await input.press('Enter');
  await expect(page.getByRole('status').filter({hasText:'Searching near:'})).toContainText('2 Example Street');
  await expect(page).toHaveURL(/\/services$/);
 }finally{release();}
});

test('mobile Escape dismisses suggestions even before the address request starts',async({page})=>{
 await page.setViewportSize({width:360,height:740});
 await page.route('**/api/address/search',route=>route.fulfill({json:{suggestions:[property(2)]}}));
 await page.goto('/services');
 const input=page.getByRole('combobox',{name:'Your postcode or street address'});
 const response=page.waitForResponse(r=>r.url().endsWith('/api/address/search'));
 await input.fill('Example Street');
 await input.press('Escape');
 await response;
 await expect(page.getByRole('button',{name:'Find address'})).toBeEnabled();
 await expect(input).toHaveAttribute('aria-expanded','false');
 await input.press('ArrowDown');
 await expect(page.getByRole('option',{selected:true,name:/2 Example Street/})).toBeVisible();
});
