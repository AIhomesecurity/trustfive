import {expect,test} from '@playwright/test';
import {safeAuthReturnPath} from '../../lib/auth-return-path';

/** Phase 4: security and privacy boundary checks. Every identity used here is
 * anonymous or a deterministic local fixture; no live account is accessed. */

test('Return-path guard rejects encoded, protocol-relative and control-character targets',()=>{
 const rejected=[
  '/jobs%2f%2e%2e/admin','/jobs/./admin','/jobs/../admin',
  '/jobs?next=https://outside.example','/jobs\u0000','/jobs\u001f',
  'https://outside.example/jobs','jobs','///jobs','/jobs\\@outside.example',
  '/auth/callback','/auth/update-password'
 ];
 for(const target of rejected)expect(safeAuthReturnPath(target)).toBe('/dashboard');
 expect(safeAuthReturnPath('/auth/update-password',true)).toBe('/auth/update-password');
 expect(safeAuthReturnPath('/bookings?booking=fixture-id')).toBe('/bookings?booking=fixture-id');
});

test('A tampered next parameter never renders an external navigation target',async({page})=>{
 await page.goto('/account?next='+encodeURIComponent('https://outside.example/steal'));
 const hrefs=await page.locator('a').evaluateAll(links=>links.map(link=>link.getAttribute('href')||''));
 expect(hrefs.some(href=>href.includes('outside.example'))).toBe(false);
 await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
});

for(const path of ['/jobs','/bookings','/messages','/schedule','/professional','/admin','/notifications','/dashboard']){
 test(`Anonymous access to ${path} is redirected with an exact return hint`,async({page})=>{
  await page.setViewportSize({width:320,height:760});
  await page.goto(path);
  await expect(page).toHaveURL(/\/account\?next=/);
  expect(new URL(page.url()).searchParams.get('next')).toBe(path);
  await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
 });
}

test('A quoted lead identifier never exposes another customer conversation',async({page})=>{
 await page.goto('/messages?quote=another-customers-quote');
 await expect(page).toHaveURL(/\/account\?next=/);
 await expect(page.getByText('TrustFive Messages')).toHaveCount(0);
 await expect(page.getByText(/never grants access to another person/)).toHaveCount(0);
});

test('Private address details never appear in public search URLs',async({page})=>{
 await page.goto('/services');
 const privateAddress='14 Example Road, London, SW1A 1AA';
 await page.getByLabel('Your postcode or street address').fill(privateAddress);
 const urlBefore=page.url();
 expect(urlBefore).not.toContain(privateAddress);
 expect(urlBefore).not.toContain('14%20Example');
 expect(urlBefore).not.toContain('address=');
});
