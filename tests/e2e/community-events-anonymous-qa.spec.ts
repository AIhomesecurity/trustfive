import {expect,test} from '@playwright/test';

// Public-route negative acceptance only. This does not simulate a signed-in
// community member, seed events, or establish real RSVP authorisation.
test.describe('community events anonymous privacy and mobile entry',()=>{
 test.use({storageState:{cookies:[],origins:[]}});
 test('anonymous visitors see sign-in rather than event publishing controls',async({page})=>{
  await page.goto('/community/events');
  await expect(page.getByRole('heading',{name:'Local events'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Sign in'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Publish event'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/I'm going|Interested/})).toHaveCount(0);
 });
 test('small-screen anonymous entry does not overflow horizontally',async({page})=>{
  await page.setViewportSize({width:360,height:740});
  await page.goto('/community/events');
  await expect(page.getByRole('heading',{name:'Local events'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Sign in'})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(overflow,'events page should fit a 360px mobile viewport').toBe(false);
 });
});
