import {expect,test} from '@playwright/test';
import {safeAuthReturnPath} from '../../lib/auth-return-path';

test('preserves legitimate protected routes and query state through sign-in',()=>{
 expect(safeAuthReturnPath('/jobs/new?trade=cctv&area=BT1')).toBe('/jobs/new?trade=cctv&area=BT1');
 expect(safeAuthReturnPath('/messages?quote=abc')).toBe('/messages?quote=abc');
 expect(safeAuthReturnPath('/auth/update-password',true)).toBe('/auth/update-password');
 expect(safeAuthReturnPath('/auth/update-password')).toBe('/dashboard');
});

test('rejects browser-normalized and ambiguous protected route paths',()=>{
 for(const path of [
  '/jobs//new','/jobs/./new','/jobs/../admin','/jobs/new./edit',
  '/jobs/new /edit','/jobs/%2e%2e/admin','/jobs\\admin',
  '/jobs/\u202eadmin','/jobs?next=\u2066admin',
  '//external.example/jobs','https://external.example/jobs',
  '/public','/jobs#private','/jobs\n/admin'
 ]){
  expect(safeAuthReturnPath(path),path).toBe('/dashboard');
 }
});

test('limits untrusted return paths without rejecting normal query parameters',()=>{
 expect(safeAuthReturnPath('/jobs?search='+ 'x'.repeat(2050))).toBe('/dashboard');
 expect(safeAuthReturnPath('/jobs?search=security%20cameras')).toBe('/jobs?search=security%20cameras');
 expect(safeAuthReturnPath(null)).toBe('/dashboard');
});
