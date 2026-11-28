import {expect,test} from '@playwright/test';

// Community events are middleware-protected. Anonymous visitors must be
// redirected to sign-in with an internal return path, never shown event data.
// This does not establish signed-in RSVP or publishing acceptance.
test.describe('community events anonymous privacy and mobile entry',()=>{
 test.use({storageState:{cookies:[],origins:[]}});
 test('anonymous visitors are redirected to sign-in without event controls',async({page})=>{
  await page.goto('/community/events');
  await expect(page).toHaveURL(/\/account\?next=%2Fdashboard(?:&|$)/);
  await expect(page.getByRole('button',{name:'Publish event'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/I'm going|Interested/})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Local events'})).toHaveCount(0);
 });
 test('small-screen anonymous event entry preserves safe sign-in redirect without overflow',async({page})=>{
  await page.setViewportSize({width:360,height:740});
  await page.goto('/community/events');
  await expect(page).toHaveURL(/\/account\?next=%2Fdashboard(?:&|$)/);
  await expect(page.getByRole('heading',{name:'Local events'})).toHaveCount(0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(overflow,'event sign-in redirect should fit a 360px mobile viewport').toBe(false);
 });
});
