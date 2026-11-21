import {test,expect} from '@playwright/test';
import {safeNotificationTarget} from '../../lib/notification-target';

const quote='2e57b536-5117-46b0-b583-c264cb2314cb';
const booking='45e1e98a-8399-4f2c-b2c5-1ba707e7a302';

test('Notifications retain specific authorised quote and booking destinations',()=>{
 expect(safeNotificationTarget('/messages?quote='+quote)).toBe('/messages?quote='+quote);
 expect(safeNotificationTarget('/bookings?booking='+booking)).toBe('/bookings?booking='+booking);
 for(const path of ['/jobs','/bookings','/messages','/professional/apply'])
  expect(safeNotificationTarget(path)).toBe(path);
});

test('Notifications reject external, malformed or mismatched target paths',()=>{
 const invalid=[
  '//external.example','https://external.example','/messages?booking='+booking,
  '/bookings?quote='+quote,'/messages?quote=not-a-uuid',
  '/bookings?booking='+booking+'&next=https://outside.example',
  '/messages#fake','/bookings\\external.example','/admin',
  '/messages?quote='+quote+'#other','/messages?quote='+quote+'&quote='+quote,
  '/jobs/'+('A'.repeat(200))
 ];
 for(const path of invalid)expect(safeNotificationTarget(path)).toBeNull();
});
