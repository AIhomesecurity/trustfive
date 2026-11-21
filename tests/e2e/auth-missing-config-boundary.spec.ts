import {expect,test} from '@playwright/test';
import {isProtectedTrustFiveRoute,shouldFailClosedAuthentication} from '../../lib/auth-boundary';

test('all authenticated marketplace and social roots fail closed without Supabase configuration',()=>{
 const paths=[
  '/profile','/jobs','/professional','/community','/community/social',
  '/community/groups','/community/events','/admin','/support/complaints',
  '/dashboard','/quotes','/bookings','/messages','/notifications',
  '/billing','/schedule'
 ];
 for(const path of paths){
  expect(isProtectedTrustFiveRoute(path),path).toBe(true);
  expect(shouldFailClosedAuthentication(path,false,true),path).toBe(true);
  expect(shouldFailClosedAuthentication(path,true,false),path).toBe(true);
  expect(shouldFailClosedAuthentication(path,false,false),path).toBe(true);
  expect(shouldFailClosedAuthentication(path,true,true),path).toBe(false);
 }
});

test('public services and similarly named route prefixes remain public',()=>{
 for(const path of ['/', '/services', '/coverage','/account','/api/health',
    '/jobs-public','/community-events','/bookings-help','/privacy/address-search']){
  expect(isProtectedTrustFiveRoute(path),path).toBe(false);
  expect(shouldFailClosedAuthentication(path,false,false),path).toBe(false);
 }
});
