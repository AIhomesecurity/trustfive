import {expect,test} from '@playwright/test';
import {retainAppointmentSelection} from '../../lib/appointment-schedule';
import {executeBookingAction} from '../../lib/booking-lifecycle';

test('calendar can recover a saved appointment without repeating the mutation',async()=>{
 let writes=0;
 const refreshed={id:'selected-booking',customer_id:'customer',professional_id:'professional',status:'booked'};
 const result=await executeBookingAction({
  runRpc:async()=>{writes++;return {error:null};},
  onCommittedLocalUpdate:()=>{},
  runRefresh:async()=>{throw Error('Synthetic calendar outage');},
  successMessage:'Appointment confirmed',
  refreshFailedMessage:'Appointment confirmed. Reload the calendar.',
  fallbackErrorMessage:'Could not update appointment',
 });
 expect(result.outcome).toBe('committed_refresh_failed');
 expect(result.message).toContain('Appointment confirmed');
 expect(retainAppointmentSelection(refreshed.id,[refreshed],'professional')).toBe(refreshed.id);
 expect(retainAppointmentSelection(refreshed.id,[{...refreshed,status:'completed'}],'professional')).toBe('');
 expect(retainAppointmentSelection(refreshed.id,[refreshed,refreshed],'professional')).toBe('');
 expect(retainAppointmentSelection(refreshed.id,[refreshed],'unrelated')).toBe('');
 expect(writes).toBe(1);
});
