/** Pure, privacy-safe helpers for the member-only events directory. */
export type CommunityEvent = {
 id:string; area_id:string; title:string; description:string; venue_label:string;
 starts_at:string; ends_at:string; host_id:string;
};
export type EventRsvp = {event_id:string;status:string};
export type EventFilter = 'all'|'going'|'interested';
export type EventTimeFilter = 'all'|'week'|'month';

export function filterCommunityEvents(
 events:readonly CommunityEvent[],
 responses:readonly EventRsvp[],
 options:{area:string;keyword:string;rsvp:EventFilter;time:EventTimeFilter;nowMs:number}
):CommunityEvent[]{
 const keyword=options.keyword.trim().toLocaleLowerCase();
 const statusById=new Map(responses.map(response=>[response.event_id,response.status]));
 const weekEnd=options.nowMs+7*24*60*60*1000;
 const monthEnd=options.nowMs+30*24*60*60*1000;
 return events.filter(event=>{
  const start=Date.parse(event.starts_at),end=Date.parse(event.ends_at);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=options.nowMs)return false;
  if(options.area&&event.area_id!==options.area)return false;
  if(keyword&&!([event.title,event.description,event.venue_label].some(text=>text.toLocaleLowerCase().includes(keyword))))return false;
  if(options.rsvp!=='all'&&statusById.get(event.id)!==options.rsvp)return false;
  if(options.time==='week'&&start>weekEnd)return false;
  if(options.time==='month'&&start>monthEnd)return false;
  return true;
 }).sort((left,right)=>Date.parse(left.starts_at)-Date.parse(right.starts_at)||left.id.localeCompare(right.id));
}

export function eventPublicationError(input:{
 area:string;availableAreaIds:readonly string[];title:string;description:string;
 venue:string;start:string;end:string;nowMs:number
}):string|null{
 if(!input.availableAreaIds.includes(input.area))return 'Choose an available neighbourhood.';
 if(input.title.trim().length<5||input.title.trim().length>120)return 'Event title must be between 5 and 120 characters.';
 if(input.description.trim().length<15||input.description.trim().length>2000)return 'Event description must be between 15 and 2,000 characters.';
 if(input.venue.trim().length<3||input.venue.trim().length>160)return 'Enter a public meeting place between 3 and 160 characters.';
 const begins=Date.parse(input.start),finishes=Date.parse(input.end);
 if(!Number.isFinite(begins)||!Number.isFinite(finishes)||begins<=input.nowMs)return 'Choose a valid future event start time.';
 if(finishes<=begins||!Number.isFinite(finishes))return 'Event end time must be after the start.';
 return null;
}
