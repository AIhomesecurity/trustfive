import {test,expect} from '@playwright/test';
import {safeNotificationTarget} from '../../lib/notification-target';

const booking='123e4567-e89b-42d3-a456-426614174000';

test.describe('private notification appointment destinations',()=>{
 test('accepts an exact booking appointment deep link',()=>{
  expect(safeNotificationTarget('/schedule?booking='+booking)).toBe('/schedule?booking='+booking);
 });
 test('preserves existing booking, quote and simple destinations',()=>{
  expect(safeNotificationTarget('/bookings?booking='+booking)).toBe('/bookings?booking='+booking);
  expect(safeNotificationTarget('/messages?quote='+booking)).toBe('/messages?quote='+booking);
  expect(safeNotificationTarget('/jobs')).toBe('/jobs');
 });
 test('rejects wrong parameter names and unvalidated identifiers',()=>{
  for(const value of ['/schedule?quote='+booking,'/schedule?booking=not-a-uuid','/schedule?booking='+booking+'&admin=1','/schedule?booking='+booking+'#fragment','/schedule?booking='+booking+'%0a','/schedule?booking='+booking+'/../admin']){
   expect(safeNotificationTarget(value),value).toBeNull();
  }
 });
 test('rejects case-confused routes and query parameter names',()=>{
  for(const value of ['/Schedule?booking='+booking,'/SCHEDULE?booking='+booking,'/schedule?Booking='+booking,'/Messages?quote='+booking,'/bookings?BOOKING='+booking]){
   expect(safeNotificationTarget(value),value).toBeNull();
  }
 });
 test('canonicalises uppercase UUID hex without changing the route',()=>{
  expect(safeNotificationTarget('/schedule?booking='+booking.toUpperCase())).toBe('/schedule?booking='+booking);
 });
 test('rejects external origins, control characters and unsupported routes',()=>{
  for(const value of ['//evil.example/schedule?booking='+booking,'https://evil.example','/schedule?booking='+booking+'\\x00','/admin','/schedule']){
   expect(safeNotificationTarget(value),value).toBeNull();
  }
 });
});
