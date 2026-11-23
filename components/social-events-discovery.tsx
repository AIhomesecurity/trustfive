'use client';
import {FormEvent,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../lib/supabase';
import {type SocialArea} from '../lib/social-discovery';
import {socialDisplayedEventIds,socialEventDateLabel,socialEventRsvpStatus,socialEventViewKey,socialEventViewReady,socialFilterEventsByOwnRsvp,socialEventSearchPattern,socialRsvpKeepsEventVisible,type SocialEventAttendanceFilter,type SocialEventSummary,type SocialEventRsvp} from '../lib/social-events';

/** Browse genuine upcoming events from existing authenticated community tables.
 * The dedicated /community/events page remains the only event publishing UI.
 */
export default function SocialEventsDiscovery({userId,areas}:{userId:string;areas:SocialArea[]}){
 const [areaId,setAreaId]=useState('');
 const [searchInput,setSearchInput]=useState(''),[search,setSearch]=useState('');
 const [attendanceFilter,setAttendanceFilter]=useState<SocialEventAttendanceFilter>('all');
 const [events,setEvents]=useState<SocialEventSummary[]>([]);
 const [responses,setResponses]=useState<SocialEventRsvp[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 // Prevent an old account's private RSVP state appearing during account or filter switches.
 const [loadedViewKey,setLoadedViewKey]=useState('');
 const [changingId,setChangingId]=useState(''),[revision,setRevision]=useState(0);
 const actionInFlight=useRef(false);
 const refreshButtonRef=useRef<HTMLButtonElement>(null);
 const attendanceFilterRef=useRef<HTMLSelectElement>(null);
 const viewKey=socialEventViewKey(userId,areaId,revision,search);
 const currentViewRef=useRef(viewKey);
 currentViewRef.current=viewKey;
 const isLoadingView=!socialEventViewReady(loadedViewKey,viewKey,loading);
 const visibleEvents=socialFilterEventsByOwnRsvp(events,responses,attendanceFilter);

 useEffect(()=>{
  if(!userId){setEvents([]);setResponses([]);setNotice('');setLoading(false);return;}
  let active=true;
  const requestKey=socialEventViewKey(userId,areaId,revision,search);
  (async()=>{
   setLoading(true);setError('');setNotice('');
   try{
    const client=supabaseBrowser();
    let query=client.from('community_events')
     .select('id,area_id,title,description,venue_label,starts_at,ends_at')
     .eq('visibility','published')
     .gt('ends_at',new Date().toISOString())
     .order('starts_at',{ascending:true}).limit(60);
    if(areaId)query=query.eq('area_id',areaId);
    const titlePattern=socialEventSearchPattern(search);
    if(titlePattern)query=query.ilike('title',titlePattern);
    const eventResult=await query;
    if(eventResult.error)throw eventResult.error;
    if(!active)return;
    const visibleEvents=(eventResult.data||[]) as SocialEventSummary[];
    // Fetch RSVP states for exactly the displayed events. A global 250-RSVP
    // cap can otherwise drop the newest event's response for active members.
    let visibleResponses:SocialEventRsvp[]=[];
    if(visibleEvents.length){
     const responseResult=await client.from('community_event_rsvps')
      .select('event_id,status')
      .eq('user_id',userId)
      .in('event_id',socialDisplayedEventIds(visibleEvents));
     if(responseResult.error)throw responseResult.error;
     visibleResponses=(responseResult.data||[]) as SocialEventRsvp[];
    }
    if(!active)return;
    setEvents(visibleEvents);
    setResponses(visibleResponses);
    setLoadedViewKey(requestKey);
   }catch{
    if(active){setEvents([]);setResponses([]);setLoadedViewKey(requestKey);setError('Unable to load community events and your private responses. Please retry.');}
   }finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[userId,areaId,revision,search]);

 function submitSearch(event:FormEvent){
  event.preventDefault();
  setSearch(searchInput.trim());
 }

 async function respond(eventId:string,status:'going'|'interested'|'none'){
  if(!userId||actionInFlight.current||isLoadingView)return;
  const requestViewKey=viewKey;
  actionInFlight.current=true;setChangingId(eventId);setNotice('');
  try{
   const result=await supabaseBrowser().rpc('set_event_response',{p_event:eventId,p_status:status});
   if(result.error)throw result.error;
   // An account or area switch may complete while the RPC is in flight.
   // Never copy the previous viewer's response into a newly loaded view.
   if(currentViewRef.current!==requestViewKey)return;
   // RSVP changes can remove this card from a filtered list; don't leave
   // keyboard focus stranded on a button that's about to be unmounted.
   if(!socialRsvpKeepsEventVisible(attendanceFilter,status))
    attendanceFilterRef.current?.focus();
   setResponses(old=>status==='none'
    ?old.filter(item=>item.event_id!==eventId)
    :[...old.filter(item=>item.event_id!==eventId),{event_id:eventId,status}]);
   setNotice(status==='none'?'Your RSVP was cancelled.':'Your RSVP was saved. Refresh if the event changes.');
  }catch{
   if(currentViewRef.current===requestViewKey)
    setNotice('Your RSVP could not be changed. Please retry after checking the event is still available.');
  }finally{actionInFlight.current=false;setChangingId('');}
 }

 return <section aria-labelledby="social-events-title">
  <h2 id="social-events-title">Community events</h2>
  <p className="subtle">Discover genuine upcoming events shared with signed-in TrustFive members. Only your own RSVP is shown, never other attendees' identities. Times appear in your device's time zone. Event venues are published by organisers; choose public meeting places and do not share home addresses.</p>
  {!userId?<div className="card" role="status">Sign in to browse and respond to community events.</div>:<>
   <form className="card social-hub-filters" onSubmit={submitSearch}>
    <label>Search event titles<input type="search" maxLength={120} placeholder="Community repair café" value={searchInput} onChange={e=>setSearchInput(e.target.value)}/></label>
    <button type="submit" className="btn secondary">Search events</button>
    <button type="button" className="btn secondary" disabled={!search&&!searchInput} onClick={()=>{setSearchInput('');setSearch('');}}>Clear search</button>
    <label>Neighbourhood<select value={areaId} onChange={e=>setAreaId(e.target.value)}>
     <option value="">All available areas</option>
     {areas.map(item=><option key={item.id} value={item.id}>{item.area_name}, {item.city}</option>)}
    </select></label>
    <label>My response
     <select ref={attendanceFilterRef} value={attendanceFilter} onChange={e=>setAttendanceFilter(e.target.value as SocialEventAttendanceFilter)}>
      <option value="all">All upcoming events</option>
      <option value="saved">My plans (Going or Interested)</option>
      <option value="going">Going</option>
      <option value="interested">Interested</option>
     </select>
    </label>
    <button type="button" className="btn secondary" disabled={Boolean(changingId)} ref={refreshButtonRef}
     onClick={()=>setRevision(v=>v+1)}>Refresh events</button>
    <Link href="/community/events" className="btn secondary">Organise an event</Link>
   </form>
   {search&&<p className="muted-note" role="status">Searching event titles for “{search}”. Results include up to 60 matching upcoming events. Clear the search to browse others.</p>}
   {notice&&<p className="notice" role="status">{notice}</p>}
   {isLoadingView?<div className="card" role="status">Loading upcoming events…</div>
   :error?<div className="card" role="alert"><p>{error}</p><button className="btn secondary" type="button" onClick={()=>{refreshButtonRef.current?.focus();setRevision(v=>v+1);}}>Retry events</button></div>
   :<>
    <p className="muted-note" role="status">{visibleEvents.length} matching upcoming {visibleEvents.length===1?'event':'events'} from {events.length} loaded (up to 60 total). Response filters only show your own RSVP data.</p>
    <div className="list">
     {!visibleEvents.length&&<p className="card">{events.length===0?'No upcoming events match the area or title you searched. You can clear the search or organise an event.':'No upcoming events match your own RSVP filter. Choose All upcoming events to see the full list.'}</p>}
     {visibleEvents.map(event=>{
      const status=socialEventRsvpStatus(responses.find(item=>item.event_id===event.id)?.status);
      return <article className="card" key={event.id}>
       <span className="pill">{areas.find(area=>area.id===event.area_id)?.area_name||'Community area'}</span>
       <h3 id={'social-event-'+event.id} style={{marginTop:12}}>{event.title}</h3>
       <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{event.description}</p>
       <p><strong>Starts:</strong> <time dateTime={event.starts_at}>{socialEventDateLabel(event.starts_at)}</time></p>
       <p><strong>Ends:</strong> <time dateTime={event.ends_at}>{socialEventDateLabel(event.ends_at)}</time></p>
       <p><strong>Public meeting place:</strong> {event.venue_label}</p>
       {status&&<p className="muted-note" role="status">Your response: {status==='going'?'Going':'Interested'}</p>}
       <div role="group" aria-labelledby={'social-event-'+event.id} className="social-hub-shortcuts">
        <button type="button" className="btn secondary" disabled={Boolean(changingId)||status==='going'}
         aria-pressed={status==='going'} onClick={()=>{void respond(event.id,'going');}}>
         {changingId===event.id?'Saving…':'Going'}
        </button>
        <button type="button" className="btn secondary" disabled={Boolean(changingId)||status==='interested'}
         aria-pressed={status==='interested'} onClick={()=>{void respond(event.id,'interested');}}>Interested</button>
        {status&&<button type="button" className="btn secondary" disabled={Boolean(changingId)}
         onClick={()=>{void respond(event.id,'none');}}>Cancel RSVP</button>}
       </div>
      </article>;
     })}
    </div>
   </>}
  </>}
 </section>;
}
