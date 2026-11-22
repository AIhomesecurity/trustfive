import {test,expect} from '@playwright/test';
import {createBookingConsentGate} from '../../lib/booking-consent-gate';

test('only one consent mutation per booking can run at once', async () => {
 const gate=createBookingConsentGate();
 let release!:()=>void;
 const waiting=new Promise<void>(resolve=>{release=resolve});
 let calls=0;
 const first=gate.run('booking-a',async()=>{calls++;await waiting;return 'saved'});
 expect(gate.isBusy('booking-a')).toBe(true);
 const second=await gate.run('booking-a',async()=>{calls++;return 'duplicate'});
 expect(second.started).toBe(false);
 expect(calls).toBe(1);
 release();
 expect(await first).toEqual({started:true,value:'saved'});
 expect(gate.isBusy('booking-a')).toBe(false);
});

test('a failed consent request unlocks retries',async()=>{
 const gate=createBookingConsentGate();
 await expect(gate.run('booking-a',async()=>{throw Error('network')})).rejects.toThrow('network');
 expect(gate.isBusy('booking-a')).toBe(false);
 expect(await gate.run('booking-a',async()=>true)).toEqual({started:true,value:true});
});

test('separate bookings and page instances do not block one another',async()=>{
 const gate=createBookingConsentGate(),other=createBookingConsentGate();
 let release!:()=>void;
 const waiting=new Promise<void>(resolve=>{release=resolve});
 const pending=gate.run('a',()=>waiting);
 expect((await gate.run('b',async()=>1)).started).toBe(true);
 expect((await other.run('a',async()=>2)).started).toBe(true);
 release();await pending;
});

test('blank booking identifiers cannot trigger consent mutation',async()=>{
 const gate=createBookingConsentGate();
 let called=false;
 expect(await gate.run('',async()=>{called=true})).toEqual({started:false});
 expect(called).toBe(false);
});
