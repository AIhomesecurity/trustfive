import {expect,test} from '@playwright/test';

test.describe('public address lookup privacy transparency',()=>{
 test.use({storageState:{cookies:[],origins:[]}});

 test('provides a discoverable public explanation of third-party location lookups',async({page})=>{
  await page.goto('/privacy/address-search');
  await expect(page.getByRole('heading',{name:'Address search and location privacy'})).toBeVisible();
  await expect(page.getByText(/postcodes\.io/).first()).toBeVisible();
  await expect(page.getByText(/Geoapify/).first()).toBeVisible();
  await expect(page.getByText(/may then send the search text to an external lookup provider/)).toBeVisible();
  await expect(page.getByText(/not a guarantee that third-party lookup providers keep no records/)).toBeVisible();
  await expect(page.getByRole('link',{name:'Return to professional search'})).toHaveAttribute('href','/services');
 });

 test('links to disclosure from homepage footer for anonymous visitors',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('link',{name:'Address search privacy'})).toHaveAttribute('href','/privacy/address-search');
 });

 test('privacy disclosure fits narrow mobile screens',async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await page.goto('/privacy/address-search');
  await expect(page.getByRole('heading',{name:'Address search and location privacy'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBe(false);
 });
});
