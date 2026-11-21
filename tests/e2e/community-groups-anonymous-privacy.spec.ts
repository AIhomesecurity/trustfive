import {expect,test} from '@playwright/test';

// Groups are middleware-protected. This verifies privacy at the route boundary;
// it does not substitute for authenticated membership or RLS acceptance tests.
test.describe('community groups anonymous privacy',()=>{
 test.use({storageState:{cookies:[],origins:[]}});
 test('anonymous visitors cannot see groups or publish controls',async({page})=>{
  await page.goto('/community/groups');
  await expect(page).toHaveURL(/\/account\?next=%2Fcommunity%2Fgroups(?:&|$)/);
  await expect(page.getByRole('button',{name:'Create community group'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Publish to group'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Neighbourhood groups'})).toHaveCount(0);
 });
 test('anonymous mobile redirect fits a narrow viewport',async({page})=>{
  await page.setViewportSize({width:360,height:740});
  await page.goto('/community/groups');
  await expect(page).toHaveURL(/\/account\?next=%2Fcommunity%2Fgroups(?:&|$)/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBe(false);
 });
});
