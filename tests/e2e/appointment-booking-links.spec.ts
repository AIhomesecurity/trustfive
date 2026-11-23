import {expect,test} from '@playwright/test';
import {resolveAppointmentBooking} from '../../lib/appointment-schedule';
import {bookingScheduleHref} from '../../lib/workflow-links';

const booking={id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',customer_id:'customer',professional_id:'professional',status:'booked'};

test('the appointment link from an accepted quote opens an older eligible booking',async()=>{
 const hints=new URL(bookingScheduleHref(booking.id.toUpperCase()),'https://fixture.test').searchParams.getAll('booking');
 const result=await resolveAppointmentBooking(hints,[],'professional',async id=>{
  expect(id).toBe(booking.id);
  return booking;
 });
 expect(result).toEqual({bookings:[booking],selectedId:booking.id});
});

test('appointment links reject foreign and completed bookings and ignore ambiguous hints',async()=>{
 for(const row of [{...booking,professional_id:'another'},{...booking,status:'completed'}]){
  expect(await resolveAppointmentBooking([booking.id],[],'professional',async()=>row))
   .toEqual({bookings:[],selectedId:''});
 }
 let lookups=0;
 for(const hints of [[booking.id,booking.id],['invalid']]){
  expect((await resolveAppointmentBooking(hints,[booking],'professional',async()=>{lookups++;return booking;})).selectedId).toBe('');
 }
 expect(lookups).toBe(0);
 expect(await resolveAppointmentBooking([booking.id],[],'professional',async()=>{throw Error('unavailable');}))
  .toEqual({bookings:[],selectedId:''});
});
