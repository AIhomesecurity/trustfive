import {test, expect} from '@playwright/test';
import {loadBookingSiteBatch} from '../../lib/booking-site-batch';

test.describe('private booking-site batch isolation', () => {
 test('never exposes inherited object properties as private booking-site records', async () => {
  const result = await loadBookingSiteBatch(
   ['__proto__', 'constructor', 'toString'],
   async id => ({label:id})
  );
  expect(Object.getPrototypeOf(result.sites)).toBe(null);
  expect(Object.keys(result.sites)).toEqual(['__proto__', 'constructor', 'toString']);
  expect(result.sites['__proto__']).toEqual({label:'__proto__'});
  expect(result.sites['constructor']).toEqual({label:'constructor'});
  expect(({} as Record<string, unknown>)['label']).toBeUndefined();
 });

 test('fetches repeated opaque booking IDs once, preserving first-seen order', async () => {
  const called:string[]=[];
  const result=await loadBookingSiteBatch(['a','b','a','c','b'],async id=>{
   called.push(id);
   return {id};
  },2);
  expect(called).toEqual(['a','b','c']);
  expect(Object.keys(result.sites)).toEqual(['a','b','c']);
  expect(result.unavailableIds).toEqual([]);
 });

 test('isolates rejected private-site requests without discarding other bookings', async () => {
  const result=await loadBookingSiteBatch(['visible','denied','later'],async id=>{
   if(id==='denied')throw new Error('RLS denied');
   return {id};
  },2);
  expect(result.sites['visible']).toEqual({id:'visible'});
  expect(result.sites['denied']).toBeNull();
  expect(result.sites['later']).toEqual({id:'later'});
  expect(result.unavailableIds).toEqual(['denied']);
 });

 test('rejects invalid batch sizes before invoking private-site RPC', async () => {
  let called=0;
  for(const size of [0,-1,1.5,21,NaN]){
   await expect(loadBookingSiteBatch(['a'],async()=>{called++;return null},size))
    .rejects.toThrow('Invalid booking-site batch size');
  }
  expect(called).toBe(0);
 });
});
