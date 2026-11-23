import {test,expect} from '@playwright/test';
import {canConfirmJobQuote} from '../../lib/quote-confirmation';

const pending={quote_id:'quote-1',job_id:'job-1',status:'pending'};
const open={id:'job-1',status:'open'};

test.describe('quote confirmation fail-closed contract',()=>{
 test('allows one pending quote for one open job',()=>{
  expect(canConfirmJobQuote('quote-1',[pending],[open])).toBe(true);
 });
 test('rejects missing, unrelated and non-pending quotes',()=>{
  expect(canConfirmJobQuote(null,[pending],[open])).toBe(false);
  expect(canConfirmJobQuote(' ',[pending],[open])).toBe(false);
  expect(canConfirmJobQuote('other',[pending],[open])).toBe(false);
  for(const status of ['accepted','withdrawn','rejected','expired']){
   expect(canConfirmJobQuote('quote-1',[{...pending,status}],[open])).toBe(false);
  }
 });
 test('rejects jobs that are not open or are missing',()=>{
  expect(canConfirmJobQuote('quote-1',[pending],[])).toBe(false);
  for(const status of ['booked','completed','cancelled','closed']){
   expect(canConfirmJobQuote('quote-1',[pending],[{...open,status}])).toBe(false);
  }
 });
 test('rejects duplicate quote identifiers even when the first is pending',()=>{
  expect(canConfirmJobQuote('quote-1',[pending,{...pending,status:'accepted'}],[open])).toBe(false);
  expect(canConfirmJobQuote('quote-1',[pending,{...pending,job_id:'job-2'}],[open])).toBe(false);
 });
 test('rejects duplicate job identifiers with contradictory state',()=>{
  expect(canConfirmJobQuote('quote-1',[pending],[open,{...open,status:'cancelled'}])).toBe(false);
 });
 test('does not mistake a different open job for the quoted job',()=>{
  expect(canConfirmJobQuote('quote-1',[pending],[{id:'job-2',status:'open'}])).toBe(false);
 });
});
