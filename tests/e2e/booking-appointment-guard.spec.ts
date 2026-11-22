import {test,expect} from '@playwright/test';
import {canManageBookingAppointment} from '../../lib/booking-appointment-guard';
const booking={id:'booking-a',customer_id:'customer-a',professional_id:'pro-a',status:'booked'};
test.describe('booking appointment selection security',()=>{
 test('permits exactly one active booking for either participant',()=>{
  expect(canManageBookingAppointment('booking-a',[booking],'customer-a')).toBe(true);
  expect(canManageBookingAppointment('booking-a',[booking],'pro-a')).toBe(true);
 });
 test('rejects other accounts, anonymous sessions and unknown bookings',()=>{
  expect(canManageBookingAppointment('booking-a',[booking],'stranger')).toBe(false);
  expect(canManageBookingAppointment('booking-a',[booking],'')).toBe(false);
  expect(canManageBookingAppointment('booking-b',[booking],'customer-a')).toBe(false);
 });
 test('rejects completed, cancelled or stale booking states',()=>{
  for(const status of ['completed','cancelled','pending','disputed']){
   expect(canManageBookingAppointment('booking-a',[{...booking,status}],'customer-a')).toBe(false);
  }
 });
 test('rejects duplicated or contradictory booking rows even when one is eligible',()=>{
  expect(canManageBookingAppointment('booking-a',[booking,booking],'customer-a')).toBe(false);
  expect(canManageBookingAppointment('booking-a',[booking,{...booking,customer_id:'other'}],'customer-a')).toBe(false);
 });
 test('rejects a non-participant even with an active status',()=>{
  expect(canManageBookingAppointment('booking-a',[{...booking,customer_id:'other',professional_id:'other-pro'}],'customer-a')).toBe(false);
 });
});
