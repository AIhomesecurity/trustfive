import {expect,test} from '@playwright/test';
import {acceptedQuoteBookingHref,customerJobBookingLinks} from '../../lib/quote-confirmation';
import {resolveLinkedBooking} from '../../lib/booking-lifecycle';

test('quote acceptance links to the exact customer booking even when the refreshed list does not contain it',async()=>{
 const id='12345678-abcd-4abc-8abc-1234567890ab';
 const href=acceptedQuoteBookingHref(id.toUpperCase());
 expect(href).toBe('/bookings?booking='+id);
 const requested=new URL(href,'https://trustfive.test').searchParams.getAll('booking');
 const booking={id,quote_id:'synthetic-quote',job_id:'synthetic-job',created_at:'2026-11-23T00:00:00Z',customer_id:'synthetic-customer',professional_id:'synthetic-professional',status:'booked'};
 expect(await resolveLinkedBooking(requested,[],'synthetic-customer',async found=>{
  expect(found).toBe(id);
  return booking;
 })).toEqual({records:[booking],selectedId:id});
 expect(await resolveLinkedBooking(requested,[],'unrelated-customer',async()=>booking)).toEqual({records:[],selectedId:''});
});

test('unexpected acceptance payloads fall back to the bookings list',()=>{
 for(const payload of [null,{},'/private', 'bad-id', 'abc&booking=other']){
  expect(acceptedQuoteBookingHref(payload)).toBe('/bookings');
 }
});

test('reloaded job cards link only to uniquely matched customer bookings',()=>{
 const id='12345678-abcd-4abc-8abc-1234567890ab';
 const booking={id,job_id:'synthetic-job',customer_id:'synthetic-customer'};
 const other={...booking,id:'22222222-abcd-4abc-8abc-1234567890ab'};
 expect(customerJobBookingLinks(['synthetic-job'],'synthetic-customer',[
  booking,{...other,customer_id:'unrelated-customer'},{...other,job_id:'unlisted-job'}
 ])).toEqual(new Map([['synthetic-job','/bookings?booking='+id]]));
 expect(customerJobBookingLinks(['synthetic-job'],'synthetic-customer',[booking,other]).size).toBe(0);
 expect(customerJobBookingLinks(['synthetic-job'],'synthetic-customer',[{...booking,id:'invalid'}]).size).toBe(0);
});
