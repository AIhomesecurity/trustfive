import {expect,test} from '@playwright/test';
import {socialDisplayedEventIds,socialEventDateLabel,socialEventIsUpcoming,socialEventRsvpStatus,socialEventViewKey,socialEventViewReady,socialFilterEventsByOwnRsvp,type SocialEventSummary} from '../../lib/social-events';

const event:SocialEventSummary={
 id:'event-1',area_id:'area-1',title:'Community repair café',
 description:'Local volunteers sharing repair advice.',
 venue_label:'Community hall',starts_at:'2026-12-01T12:00:00Z',
 ends_at:'2026-12-01T14:00:00Z'
};
test('event discovery shows only valid upcoming published dates from existing RLS rows',()=>{
 expect(socialEventIsUpcoming(event,Date.parse('2026-11-22T12:00:00Z'))).toBe(true);
 expect(socialEventIsUpcoming(event,Date.parse('2026-12-01T14:00:00Z'))).toBe(false);
 expect(socialEventIsUpcoming({...event,ends_at:event.starts_at},0)).toBe(false);
 expect(socialEventIsUpcoming({...event,ends_at:'invalid'},0)).toBe(false);
});
test('only genuine owner RSVP statuses are recognised',()=>{
 expect(socialEventRsvpStatus('going')).toBe('going');
 expect(socialEventRsvpStatus('interested')).toBe('interested');
 expect(socialEventRsvpStatus('cancelled')).toBeNull();
 expect(socialEventRsvpStatus(undefined)).toBeNull();
});
test('invalid event timestamps never render misleading dates',()=>{
 expect(socialEventDateLabel('not-a-date')).toBe('Date unavailable');
 expect(socialEventDateLabel('2026-12-01T12:00:00Z')).not.toBe('Date unavailable');
});

test('private RSVP lookup targets only the visible event page, never unrelated history',()=>{
 const first={...event,id:'visible-1'};
 const second={...event,id:'visible-2'};
 expect(socialDisplayedEventIds([first,second])).toEqual(['visible-1','visible-2']);
 expect(socialDisplayedEventIds([])).toEqual([]);
 expect(socialDisplayedEventIds([first,first,second])).toEqual(['visible-1','visible-2']);
 const many=Array.from({length:300},(_,i)=>({...event,id:'event-'+i}));
 expect(socialDisplayedEventIds(many)).toHaveLength(60);
 expect(socialDisplayedEventIds(many).at(-1)).toBe('event-59');
});

test('private RSVP state is never reused for a new account, neighbourhood or refresh',()=>{
 const original=socialEventViewKey('user-a','area-one',0);
 expect(socialEventViewReady(original,original,false)).toBe(true);
 expect(socialEventViewReady(original,original,true)).toBe(false);
 expect(socialEventViewReady(original,socialEventViewKey('user-b','area-one',0),false)).toBe(false);
 expect(socialEventViewReady(original,socialEventViewKey('user-a','area-two',0),false)).toBe(false);
 expect(socialEventViewReady(original,socialEventViewKey('user-a','area-one',1),false)).toBe(false);
});

test('my events uses only the current account RSVP records and preserves event order',()=>{
 const events=[
  {...event,id:'a'},
  {...event,id:'b'},
  {...event,id:'c'},
  {...event,id:'d'}
 ];
 const mine=[
  {event_id:'b',status:'going' as const},
  {event_id:'d',status:'interested' as const},
  {event_id:'nonvisible',status:'going' as const}
 ];
 expect(socialFilterEventsByOwnRsvp(events,mine,'all').map(x=>x.id)).toEqual(['a','b','c','d']);
 expect(socialFilterEventsByOwnRsvp(events,mine,'saved').map(x=>x.id)).toEqual(['b','d']);
 expect(socialFilterEventsByOwnRsvp(events,mine,'going').map(x=>x.id)).toEqual(['b']);
 expect(socialFilterEventsByOwnRsvp(events,mine,'interested').map(x=>x.id)).toEqual(['d']);
 expect(socialFilterEventsByOwnRsvp(events,[],'saved')).toEqual([]);
 expect(socialFilterEventsByOwnRsvp([],mine,'going')).toEqual([]);
});
