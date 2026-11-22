/** RLS-visible event summaries. No attendee identities or private customer data. */
export type SocialEventSummary={
 id:string;area_id:string;title:string;description:string;venue_label:string;
 starts_at:string;ends_at:string;
};
export type SocialEventRsvp={event_id:string;status:'going'|'interested'};

export function socialEventIsUpcoming(event:SocialEventSummary,nowMs:number):boolean{
 const end=Date.parse(event.ends_at),start=Date.parse(event.starts_at);
 return Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end>nowMs;
}
export function socialEventDateLabel(timestamp:string,locale='en-GB'):string{
 const date=new Date(timestamp);
 return Number.isFinite(date.getTime())?date.toLocaleString(locale):'Date unavailable';
}
export function socialEventRsvpStatus(value:string|undefined):'going'|'interested'|null{
 return value==='going'||value==='interested'?value:null;
}

/** Limit private RSVP reads to the current page of already authorised events.
 * Never query an unbounded personal RSVP history for a feed card.
 */
export function socialDisplayedEventIds(events:readonly SocialEventSummary[]):string[]{
 return [...new Set(events.map(event=>event.id).filter(Boolean))].slice(0,60);
}

/** Key a private RSVP result to its precise account, area and refresh request.
 * A previous user's RSVP state must never be shown while a new view loads.
 */
export function socialEventViewKey(userId:string,areaId:string,revision:number):string{
 return JSON.stringify([userId,areaId,revision]);
}
export function socialEventViewReady(loadedKey:string,currentKey:string,loading:boolean):boolean{
 return !loading&&loadedKey===currentKey;
}

/** This filter only operates on events already authorised by Supabase RLS.
 * It never looks up another person's attendance or discloses attendee lists.
 */
export type SocialEventAttendanceFilter='all'|'going'|'interested'|'saved';
export function socialFilterEventsByOwnRsvp(
 events:readonly SocialEventSummary[],
 responses:readonly SocialEventRsvp[],
 filter:SocialEventAttendanceFilter
):SocialEventSummary[]{
 if(filter==='all')return [...events];
 const mine=new Map(responses.map(item=>[item.event_id,item.status]));
 return events.filter(event=>{
  const response=socialEventRsvpStatus(mine.get(event.id));
  return filter==='saved'?response!==null:response===filter;
 });
}
