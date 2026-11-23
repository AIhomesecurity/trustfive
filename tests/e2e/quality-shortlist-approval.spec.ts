import {expect,test} from '@playwright/test';

test('saved professional IDs are never presented as current approval without live eligibility',async({page})=>{
 const staleId='00000000-0000-4000-8000-000000000001';
 await page.addInitScript(id=>{
  window.localStorage.setItem('trustfive-shortlist-v1',JSON.stringify([id]));
 },staleId);
 await page.route('**/rest/v1/trades?*',route=>route.fulfill({json:[]}));
 await page.route('**/rest/v1/service_areas?*',route=>route.fulfill({json:[]}));
 await page.route('**/rest/v1/rpc/find_trustfive_professionals_with_reviews',route=>route.fulfill({json:[]}));
 await page.goto('/services');
 await expect(page.getByRole('heading',{name:'Compare approved professionals'})).toBeVisible();
 await expect(page.getByText('Your saved selections are not in these current verified search results.')).toBeVisible();
 await expect(page.getByText('Currently approved in these results')).toHaveCount(0);
 await expect(page.getByRole('link',{name:'View full profile'})).toHaveCount(0);
 await page.getByRole('button',{name:'Clear comparison'}).click();
 await expect(page.getByRole('heading',{name:'Compare approved professionals'})).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.localStorage.getItem('trustfive-shortlist-v1'))).toBe('[]');
});
