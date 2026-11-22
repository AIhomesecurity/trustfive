import {expect,test} from '@playwright/test';
import {quoteMessagesHref,bookingScheduleHref,bookingHistoryHref,authorisedQuoteSelection,authorisedBookingSelection} from '../../lib/workflow-links';

test('private workflow links encode opaque identifiers without allowing query injection',()=>{
 const id='abc?next=/admin&quote=other';
 expect(quoteMessagesHref(id)).toBe('/messages?quote=abc%3Fnext%3D%2Fadmin%26quote%3Dother');
 expect(bookingScheduleHref(id)).toBe('/schedule?booking=abc%3Fnext%3D%2Fadmin%26quote%3Dother');
 expect(bookingHistoryHref(id)).toBe('/bookings?booking=abc%3Fnext%3D%2Fadmin%26quote%3Dother');
});
test('invalid navigation identifiers fail closed without throwing',()=>{
 for(const id of ['', ' ', ' leading','trailing ', 'abc\nother', '\ud800', 'x'.repeat(129)]){
  expect(quoteMessagesHref(id)).toBe('/messages');
  expect(bookingScheduleHref(id)).toBe('/schedule');
  expect(bookingHistoryHref(id)).toBe('/bookings');
 }
});
test('authorised selections require an exact allowed identifier',()=>{
 const allowed=['quote-a','quote-b'];
 expect(authorisedQuoteSelection('quote-a',allowed)).toBe('quote-a');
 expect(authorisedQuoteSelection('quote-c',allowed)).toBe('');
 expect(authorisedQuoteSelection(null,allowed)).toBe('');
 expect(authorisedBookingSelection('quote-b',allowed)).toBe('quote-b');
 expect(authorisedBookingSelection('quote-b ',['quote-b '])).toBe('');
 expect(authorisedBookingSelection('\ud800',['\ud800'])).toBe('');
});
