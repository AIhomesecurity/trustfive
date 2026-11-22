import {expect,test} from '@playwright/test';
import {createNotificationReadGate} from '../../lib/notification-read-gate';

test('only one notification mutation can run before UI rerenders',async()=>{
 const gate=createNotificationReadGate();
 let resolve!: (value:string)=>void;
 const first=gate.run(()=>new Promise<string>(done=>{resolve=done;}));
 expect(gate.busy).toBe(true);
 let secondCalls=0;
 expect(await gate.run(async()=>{secondCalls++;return 'other';})).toEqual({started:false});
 expect(secondCalls).toBe(0);
 resolve('saved');
 expect(await first).toEqual({started:true,value:'saved'});
 expect(gate.busy).toBe(false);
});

test('failed notification mutation releases lock for retry',async()=>{
 const gate=createNotificationReadGate();
 await expect(gate.run(async()=>{throw new Error('denied');})).rejects.toThrow('denied');
 expect(gate.busy).toBe(false);
 expect(await gate.run(async()=>true)).toEqual({started:true,value:true});
});

test('different page instances do not share mutation locks',async()=>{
 const a=createNotificationReadGate(),b=createNotificationReadGate();
 let release!:()=>void;
 const pending=a.run(()=>new Promise<void>(resolve=>{release=resolve;}));
 expect(await b.run(async()=>42)).toEqual({started:true,value:42});
 release();await pending;
});
