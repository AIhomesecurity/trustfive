import {expect,test} from '@playwright/test';
import {buildDashboardActions} from '../../lib/dashboard-actions';

const bookingId='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const empty={jobs:[],bookings:[],applications:[]};
const booking={id:bookingId,customer_id:'customer',professional_id:'professional',status:'awaiting_customer'};

test('customer sees own completion confirmation before open jobs',()=>{
 const actions=buildDashboardActions({...empty,view:'customer',userId:'customer',
  bookings:[{...booking,id:'other',customer_id:'other'},booking,booking],
  jobs:[{id:'open',title:'Fit a door',status:'open'},{id:'draft',title:'Draft',status:'draft'}]
 });
 expect(actions.map(({id,href,priority})=>[id,href,priority])).toEqual([
  ['booking-'+bookingId,'/bookings?booking='+bookingId,'attention'],
  ['job-open','/jobs','update']
 ]);
});

test('professional sees own booked work and pending applications only',()=>{
 const actions=buildDashboardActions({...empty,view:'professional',userId:'professional',
  bookings:[booking,{...booking,id:'malformed?other=record',status:'booked'},{...booking,status:'booked',professional_id:'other'}],
  applications:[{id:'pending',status:'pending'},{id:'review',status:'under_review'},{id:'rejected',status:'rejected'}]
 });
 expect(actions.map(({id,href})=>[id,href])).toEqual([
  ['booking-malformed?other=record','/bookings'],['application-pending','/professional/apply'],['application-review','/professional/apply']
 ]);
});

test('signed-out dashboard produces no actions',()=>{
 expect(buildDashboardActions({...empty,view:'customer',userId:'',bookings:[booking]})).toEqual([]);
});

test('limits to six unique actions in input order',()=>{
 const jobs=Array.from({length:8},(_,id)=>({id:String(id),title:'Job '+id,status:'open'}));
 const actions=buildDashboardActions({...empty,view:'customer',userId:'customer',jobs:[jobs[0],...jobs]});
 expect(actions.map(action=>action.id)).toEqual(['job-0','job-1','job-2','job-3','job-4','job-5']);
});
