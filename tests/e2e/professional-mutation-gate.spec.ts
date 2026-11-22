import {test,expect} from '@playwright/test';
import {createProfessionalMutationGate} from '../../lib/professional-mutation-gate';

test('rapid quote submissions execute only one write',async()=>{
 const gate=createProfessionalMutationGate();
 let release!:()=>void;
 const waiting=new Promise<void>(resolve=>{release=resolve});
 let writes=0;
 const first=gate.run(async()=>{writes++;await waiting;return 'quote'});
 expect(gate.isBusy()).toBe(true);
 expect(await gate.run(async()=>{writes++;return 'duplicate'})).toEqual({started:false});
 expect(writes).toBe(1);
 release();
 expect(await first).toEqual({started:true,value:'quote'});
 expect(gate.isBusy()).toBe(false);
});

test('completion mutation cannot overlap an in-flight quote',async()=>{
 const gate=createProfessionalMutationGate();
 let release!:()=>void;
 const waiting=new Promise<void>(resolve=>{release=resolve});
 const quote=gate.run(()=>waiting);
 let completionCalls=0;
 expect(await gate.run(async()=>{completionCalls++;})).toEqual({started:false});
 expect(completionCalls).toBe(0);
 release();await quote;
 expect((await gate.run(async()=>{completionCalls++;})).started).toBe(true);
 expect(completionCalls).toBe(1);
});

test('failed mutation releases lock for a genuine retry',async()=>{
 const gate=createProfessionalMutationGate();
 await expect(gate.run(async()=>{throw Error('connection lost')})).rejects.toThrow('connection lost');
 expect(gate.isBusy()).toBe(false);
 expect(await gate.run(async()=>42)).toEqual({started:true,value:42});
});

test('separate professional page instances have independent guards',async()=>{
 const a=createProfessionalMutationGate(),b=createProfessionalMutationGate();
 let release!:()=>void;
 const waiting=new Promise<void>(resolve=>{release=resolve});
 const first=a.run(()=>waiting);
 expect((await b.run(async()=>1)).started).toBe(true);
 release();await first;
});
