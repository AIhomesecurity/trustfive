import {expect,test} from '@playwright/test';

// Anonymous access checks only. These do not create users, quotes, or bookings.
// Authenticated professional lead permissions require independently approved
// allocations and a separate opt-in staging acceptance run.
// Worker-scoped capture settings must be configured at file scope in Playwright.
// trace/screenshot/video stay outside test.describe(), while preserving empty
// anonymous storageState.
test.use({storageState:{cookies:[],origins:[]},trace:'off',screenshot:'off',video:'off'});

test.describe('professional quote workspace anonymous boundary',()=>{

 test('anonymous visitor is redirected before seeing professional leads',async({page})=>{
  await page.goto('/quotes');
  await expect(page).toHaveURL(/\/account\?next=%2Fquotes(?:&|$)/);
  await expect(page.getByRole('heading',{name:'Leads, quotes and work'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Prepare a quote'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Send quote'})).toHaveCount(0);
 });

 test('anonymous quote deep-link cannot expose another customer conversation',async({page})=>{
  await page.goto('/messages?quote=00000000-0000-4000-8000-000000000000');
  await expect(page).toHaveURL(/\/account\?next=/);
  await expect(page.getByRole('heading',{name:'Messages'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/send message/i})).toHaveCount(0);
 });
});
