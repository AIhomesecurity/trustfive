import {test, expect} from '@playwright/test';
import {canConfirmCompletedBookingFromRecords} from '../../lib/booking-completion-guard';

const ready = {id:'booking-a',customer_id:'customer-a',status:'awaiting_customer'};

test.describe('customer completion confirmation isolation', () => {
 test('permits exactly one awaiting-customer booking owned by the customer', () => {
  expect(canConfirmCompletedBookingFromRecords('booking-a',[ready],'customer-a')).toBe(true);
 });
 test('denies another customer and professional attempting to confirm', () => {
  expect(canConfirmCompletedBookingFromRecords('booking-a',[ready],'customer-b')).toBe(false);
  expect(canConfirmCompletedBookingFromRecords('booking-a',[ready],'')).toBe(false);
 });
 test('denies stale, completed and missing bookings', () => {
  expect(canConfirmCompletedBookingFromRecords('booking-a',[{...ready,status:'completed'}],'customer-a')).toBe(false);
  expect(canConfirmCompletedBookingFromRecords('booking-b',[ready],'customer-a')).toBe(false);
  expect(canConfirmCompletedBookingFromRecords(null,[ready],'customer-a')).toBe(false);
 });
 test('denies duplicate rows even if one appears valid', () => {
  expect(canConfirmCompletedBookingFromRecords('booking-a',[ready,{...ready,status:'completed'}],'customer-a')).toBe(false);
  expect(canConfirmCompletedBookingFromRecords('booking-a',[ready,{...ready}],'customer-a')).toBe(false);
 });
 test('ignores unrelated bookings without weakening the selected booking guard', () => {
  expect(canConfirmCompletedBookingFromRecords('booking-a',[{id:'booking-b',customer_id:'customer-b',status:'awaiting_customer'},ready],'customer-a')).toBe(true);
 });
});
