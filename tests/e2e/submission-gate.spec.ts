import {expect,test} from '@playwright/test';
import {createSubmissionGate} from '../../lib/submission-gate';

test('two synchronous publish attempts admit only one mutation',()=>{
 const gate=createSubmissionGate();
 expect(gate.acquire()).toBe(true);
 expect(gate.acquire()).toBe(false);
 expect(gate.isBusy()).toBe(true);
});

test('failed publication releases the gate for a deliberate retry',()=>{
 const gate=createSubmissionGate();
 expect(gate.acquire()).toBe(true);
 gate.release();
 expect(gate.acquire()).toBe(true);
});

test('successful publication remains guarded until its refresh completes',async()=>{
 const gate=createSubmissionGate();
 expect(gate.acquire()).toBe(true);
 await Promise.resolve();
 expect(gate.acquire()).toBe(false);
 gate.release();
 expect(gate.acquire()).toBe(true);
});

test('independent forms do not block each other',()=>{
 const a=createSubmissionGate(),b=createSubmissionGate();
 expect(a.acquire()).toBe(true);
 expect(b.acquire()).toBe(true);
});
