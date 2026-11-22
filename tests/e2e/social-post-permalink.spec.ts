import {expect,test} from '@playwright/test';
import {socialPostIdFromRoute} from '../../lib/social-post-route';

test('only canonical UUID post paths are valid',()=>{
 expect(socialPostIdFromRoute('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'))
  .toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
 expect(socialPostIdFromRoute('AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE'))
  .toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
 for(const unsafe of ['', 'bad-id', '1', 'abc/../def', 'abc?next=https://evil.example','a'.repeat(100)]){
  expect(socialPostIdFromRoute(unsafe),unsafe).toBeNull();
 }
 expect(socialPostIdFromRoute(['aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'])).toBeNull();
 expect(socialPostIdFromRoute(undefined)).toBeNull();
});

test.describe('protected social discussion permalink',()=>{
 test.use({storageState:{cookies:[],origins:[]}});
 test('redirects anonymous visitors without exposing discussion',async({page})=>{
  await page.goto('/community/posts/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  await expect(page).toHaveURL(/\/account\?next=%2Fcommunity%2Fposts%2F/);
  await expect(page.getByRole('heading',{name:'Neighbourhood conversation'})).toHaveCount(0);
 });
});
