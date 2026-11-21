import {expect,test} from '@playwright/test';
import {eventPublicationError,filterCommunityEvents,type CommunityEvent} from '../../lib/community-event-discovery';

const now=Date.parse('2026-11-21T12:00:00Z');
const events:CommunityEvent[]=[
 {id:'a',area_id:'north',title:'Community gardening',description:'Help plant flowers',venue_label:'Community garden',starts_at:'2026-11-22T10:00:00Z',ends_at:'2026-11-22T12:00:00Z',host_id:'u1'},
 {id:'b',area_id:'south',title:'Neighbourhood clean-up',description:'Tidy the park',venue_label:'Town hall',starts_at:'2026-12-15T10:00:00Z',ends_at:'2026-12-15T12:00:00Z',host_id:'u2'},
 {id:'c',area_id:'north',title:'Expired event',description:'Already finished',venue_label:'Library',starts_at:'2026-11-20T10:00:00Z',ends_at:'2026-11-20T12:00:00Z',host_id:'u3'}
];
const responses=[{event_id:'a',status:'going'},{event_id:'b',status:'interested'}];
const opts={area:'',keyword:'',rsvp:'all' as const,time:'all' as const,nowMs:now};

test('event directory sorts live events, excludes completed meetings and never invents rows',()=>{
 expect(filterCommunityEvents([...events].reverse(),responses,opts).map(e=>e.id)).toEqual(['a','b']);
 expect(filterCommunityEvents([],responses,opts)).toEqual([]);
});

test('neighbourhood, keyword, RSVP and date filters combine without leaking other events',()=>{
 expect(filterCommunityEvents(events,responses,{...opts,area:'north'}).map(e=>e.id)).toEqual(['a']);
 expect(filterCommunityEvents(events,responses,{...opts,keyword:'TOWN HALL'}).map(e=>e.id)).toEqual(['b']);
 expect(filterCommunityEvents(events,responses,{...opts,rsvp:'going'}).map(e=>e.id)).toEqual(['a']);
 expect(filterCommunityEvents(events,responses,{...opts,rsvp:'interested'}).map(e=>e.id)).toEqual(['b']);
 expect(filterCommunityEvents(events,responses,{...opts,time:'week'}).map(e=>e.id)).toEqual(['a']);
 expect(filterCommunityEvents(events,responses,{...opts,time:'month'}).map(e=>e.id)).toEqual(['a','b']);
 expect(filterCommunityEvents(events,responses,{...opts,area:'north',rsvp:'interested'})).toEqual([]);
});

const form={area:'north',availableAreaIds:['north'],title:'Community picnic',description:'Come meet your neighbours.',venue:'Community centre',start:'2026-11-25T11:00:00Z',end:'2026-11-25T12:00:00Z',nowMs:now};
test('publication validates listed areas, meaningful details and future chronological times',()=>{
 expect(eventPublicationError(form)).toBeNull();
 expect(eventPublicationError({...form,area:'unlisted'})).toMatch(/neighbourhood/i);
 expect(eventPublicationError({...form,title:'  x  '})).toMatch(/title/i);
 expect(eventPublicationError({...form,description:'  short  '})).toMatch(/description/i);
 expect(eventPublicationError({...form,venue:' x '})).toMatch(/meeting place/i);
 expect(eventPublicationError({...form,start:'2026-11-20T11:00:00Z'})).toMatch(/future/i);
 expect(eventPublicationError({...form,end:'2026-11-25T10:00:00Z'})).toMatch(/after/i);
 expect(eventPublicationError({...form,end:'invalid'})).toMatch(/after/i);
});
