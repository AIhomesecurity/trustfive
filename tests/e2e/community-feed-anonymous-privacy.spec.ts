import {expect,test} from '@playwright/test';

// The community feed is a protected route. This test deliberately does not
// create fake members, posts, or authentication tokens.
test.describe('community feed anonymous privacy',()=>{
 test.use({storageState:{cookies:[],origins:[]}});
 test('redirects anonymous visitors to account without exposing posts or posting controls',async({page})=>{
  await page.goto('/community');
  await expect(page).toHaveURL(/\/account\?next=%2Fdashboard(?:&|$)/);
  await expect(page.getByRole('button',{name:'Publish post'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Add reply'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Neighbourhood feed'})).toHaveCount(0);
 });
 test('mobile anonymous redirect does not overflow horizontally',async({page})=>{
  await page.setViewportSize({width:360,height:740});
  await page.goto('/community');
  await expect(page).toHaveURL(/\/account\?next=%2Fdashboard(?:&|$)/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBe(false);
 });
});
