import {test,expect} from '@playwright/test';
import {safeAuthReturnPath} from '../../lib/auth-return-path';

test('Sign-in preserves protected TrustFive destinations with authorised navigation hints',()=>{
 const destinations=[
  '/jobs?trade=plumbing&area=test-area',
  '/messages?quote=2e57b536-5117-46b0-b583-c264cb2314cb',
  '/schedule?booking=45e1e98a-8399-4f2c-b2c5-1ba707e7a302',
  '/bookings?booking=45e1e98a-8399-4f2c-b2c5-1ba707e7a302',
  '/professional','/dashboard','/community/groups','/notifications'
 ];
 for(const path of destinations)expect(safeAuthReturnPath(path)).toBe(path);
 expect(safeAuthReturnPath('/auth/update-password')).toBe('/dashboard');
 expect(safeAuthReturnPath('/auth/update-password',true)).toBe('/auth/update-password');
});

test('Return paths fail closed for external origins, traversal and arbitrary routes',()=>{
 const disallowed=[
  null,'','https://outside.example/steal','//outside.example/steal',
  '/\\outside.example/steal','/jobs\\outside.example',
  '/jobs/../admin','/jobs/%2e%2e/admin','/jobs%2f%2e%2e',
  '/jobs#fragment','/jobs\nLocation: https://outside.example',
  '/unapproved-route','/auth/callback','/jobs'+('a'.repeat(2100))
 ];
 for(const path of disallowed)expect(safeAuthReturnPath(path)).toBe('/dashboard');
});

test('Anonymous quote and booking links retain their destination through account authentication',async({page})=>{
 for(const destination of [
  '/messages?quote=other-customer-quote',
  '/schedule?booking=other-customer-booking',
  '/bookings?booking=other-customer-booking'
 ]){
  await page.goto(destination);
  await expect(page).toHaveURL(/\/account\?next=/);
  const account=new URL(page.url());
  const next=account.searchParams.get('next');
  expect(next).toBe(destination);
  expect(safeAuthReturnPath(next)).toBe(destination);
  await expect(page.getByRole('heading',{name:'Create your account'})).toBeVisible();
 }
});
