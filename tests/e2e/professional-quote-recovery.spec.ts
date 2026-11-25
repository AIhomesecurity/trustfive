import {expect,test} from '@playwright/test';
import {createSingleFlightLock,executeBookingAction} from '../../lib/booking-lifecycle';

test('a saved professional quote with a failed refresh is acknowledged once',async()=>{
 const lock=createSingleFlightLock();
 let writes=0;
 let commits=0;
 const submit=()=>lock.run(()=>executeBookingAction({
  runRpc:async()=>{writes++;return {error:null};},
  onCommittedLocalUpdate:()=>{commits++;},
  runRefresh:async()=>{throw Error('Synthetic reload failure');},
  successMessage:'Quote submitted',
  refreshFailedMessage:'Quote submitted. Refresh your leads.',
  fallbackErrorMessage:'Unable to submit quote',
 }));
 const [outcome]=await Promise.all([submit(),submit()]);
 expect(outcome).toMatchObject({skipped:false,value:{outcome:'committed_refresh_failed',committed:true}});
 expect(writes).toBe(1);
 expect(commits).toBe(1);
});

test('a rejected quote keeps the draft and skips reload',async()=>{
 let cleared=false;
 let refreshed=false;
 const outcome=await executeBookingAction({
  runRpc:async()=>({error:{message:'Synthetic unavailable lead'}}),
  onCommittedLocalUpdate:()=>{cleared=true;},
  runRefresh:async()=>{refreshed=true;},
  successMessage:'Quote submitted',
  refreshFailedMessage:'Quote submitted. Refresh your leads.',
  fallbackErrorMessage:'Unable to submit quote',
 });
 expect(outcome).toMatchObject({outcome:'rpc_error',committed:false});
 expect(cleared).toBe(false);
 expect(refreshed).toBe(false);
});
