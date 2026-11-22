'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../lib/supabase';
import {type SocialArea} from '../lib/social-discovery';
import {socialEventDateLabel,socialEventRsvpStatus,type SocialEventSummary,type SocialEventRsvp} from '../lib/social-events';

/** Browse genuine upcoming events from existing authenticated community tables.
 * The dedicated /community/events page remains the only event publishing UI.
 */
export default function SocialEventsDiscovery({userId,areas}:{userId:string;areas:SocialArea[]}){
 const [areaId,setAreaId]=useState('');
 const [events,setEvents]=useState<SocialEventSummary[]>([]);
 const [responses,setResponses]=useState<SocialEventRsvp[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [changingId,setChangingId]=useState(''),[revision,setRevision]=useState(0);
 const actionInFlight=useRef(false);

 useEffect(()=>{
  if(!userId){setLoading(false);return;}
  let active=true;
  (async()=>{
   setLoading(true);setError('');
   try{
    const client=supabaseBrowser();
    let query=client.from('community_events')
     .select('id,area_id,title,description,venue_label,starts_at,ends_at')
     .eq('visibility','published')
     .gt('ends_at',new Date().toISOString())
     .order('starts_at',{ascending:true}).limit(60);
    if(areaId)query=query.eq('area_id',areaId);
    const [eventResult,responseResult]=await Promise.all([
     query,
     client.from('community_event_rsvps').select('event_id,status').eq('user_id',userId).limit(250)
    ]);
    if(eventResult.error)throw eventResult.error;
    if(responseResult.error)throw responseResult.error;
    if(!active)return;
    setEvents((eventResult.data||[]) as SocialEventSummary[]);
    setResponses((responseResult.data||[]) as SocialEventRsvp[]);
   }catch{
    if(active){setEvents([]);setResponses([]);setError('Unable to load community events and your private responses. Please retry.');}
   }finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[userId,areaId,revision]);

 async function respond(eventId:string,status:'going'|'interested'|'none'){
  if(!userId||actionInFlight.current)return;
  actionInFlight.current=true;setChangingId(eventId);setNotice('');
  try{
   const result=await supabaseBrowser().rpc('set_event_response',{p_event:eventId,p_status:status});
   if(result.error)throw result.error;
   setResponses(old=>status==='none'
    ?old.filter(item=>item.event_id!==eventId)
    :[...old.filter(item=>item.event_id!==eventId),{event_id:eventId,status}]);
   setNotice(status==='none'?'Your RSVP was cancelled.':'Your RSVP was saved. Refresh if the event changes.');
  }catch{setNotice('Your RSVP could not be changed. Please retry after checking the event is still available.');}
  finally{actionInFlight.current=false;setChangingId('');}
 }

 return <section aria-labelledby="social-events-title">
  <h2 id="social-events-title">Community events</h2>
  <p className="subtle">Discover genuine upcoming events shared with signed-in TrustFive members. Only your own RSVP is shown, never other attendees' identities. Event venues are published by their organisers and should be public meeting places, not home addresses.</p>
  {!userId?<div className="card" role="status">Sign in to browse and respond to community events.</div>:<>
   <div className="card social-hub-filters">
    <label>Neighbourhood<select value={areaId} onChange={e=>setAreaId(e.target.value)}>
     <option value="">All available areas</option>
     {areas.map(item=><option key={item.id} value={item.id}>{item.area_name}, {item.city}</option>)}
    </select></label>
    <button type="button" className="btn secondary" disabled={Boolean(changingId)}
     onClick={()=>setRevision(v=>v+1)}>Refresh events</button>
    <Link href="/community/events" className="btn secondary">Organise an event</Link>
   </div>
   {notice&&<p className="notice" role="status">{notice}</p>}
   {loading?<div className="card" role="status">Loading upcoming events…</div>
   :error?<div className="card" role="alert"><p>{error}</p><button className="btn secondary" type="button" onClick={()=>setRevision(v=>v+1)}>Retry events</button></div>
   :<>
    <p className="muted-note" role="status">{events.length} upcoming {events.length===1?'event':'events'} in this selection (up to 60 shown).</p>
    <div className="list">
     {!events.length&&<p className="card">No upcoming events match this neighbourhood yet. You can organise one on the events page.</p>}
     {events.map(event=>{
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
