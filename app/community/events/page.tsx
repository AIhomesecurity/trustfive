'use client';
import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../../lib/supabase';
import {eventPublicationError,filterCommunityEvents,type EventFilter,type EventTimeFilter} from '../../../lib/community-event-discovery';
type Area={id:string;area_name:string;city:string};
type Event={id:string;area_id:string;title:string;description:string;venue_label:string;starts_at:string;ends_at:string;host_id:string};
type RSVP={event_id:string;status:string};
export default function CommunityEvents(){
 const [userId,setUserId]=useState('');
 const [areas,setAreas]=useState<Area[]>([]);
 const [events,setEvents]=useState<Event[]>([]);
 const [responses,setResponses]=useState<RSVP[]>([]);
 const [area,setArea]=useState(''),[title,setTitle]=useState(''),[description,setDescription]=useState('');
 const [venue,setVenue]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState('');
 const [endResetNotice,setEndResetNotice]=useState('');
 const [searchArea,setSearchArea]=useState(''),[keyword,setKeyword]=useState('');
 const [rsvpFilter,setRsvpFilter]=useState<EventFilter>('all'),[timeFilter,setTimeFilter]=useState<EventTimeFilter>('all');
 const [nowMs,setNowMs]=useState(()=>Date.now());
 const refreshGeneration=useRef(0);
 const visibleEvents=useMemo(()=>filterCommunityEvents(events,responses,{area:searchArea,keyword,rsvp:rsvpFilter,time:timeFilter,nowMs}),[events,responses,searchArea,keyword,rsvpFilter,timeFilter,nowMs]);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [pendingRsvpEventId,setPendingRsvpEventId]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [loadError,setLoadError]=useState(false);
 async function refresh(){
  const request=++refreshGeneration.current;
  const s=supabaseBrowser();
  const [e,r]=await Promise.all([
   s.from('community_events').select('id,area_id,title,description,venue_label,starts_at,ends_at,host_id')
    .eq('visibility','published').gte('ends_at',new Date().toISOString()).order('starts_at').limit(100),
   s.from('community_event_rsvps').select('event_id,status')
  ]);
  if(e.error)throw e.error;if(r.error)throw r.error;
  if(request!==refreshGeneration.current)return;
  setEvents(e.data||[]);setResponses(r.data||[]);setNowMs(Date.now());setLoadError(false);
 }
 useEffect(()=>{(async()=>{try{
  const s=supabaseBrowser();
  const [{data:{user},error},a]=await Promise.all([
   s.auth.getUser(),s.from('service_areas').select('id,area_name,city').order('city')
  ]);
  if(error)throw error;
  if(!user){setNotice('Sign in to view and join local events.');return;}
  if(a.error)throw a.error;setUserId(user.id);setAreas(a.data||[]);await refresh();
 }catch(e){setLoadError(true);setNotice('Unable to load local events. Please try again.');}finally{setLoading(false);}})()},[]);
 async function retryEvents(){if(busy)return;setBusy(true);setNotice('');try{await refresh();}catch{setLoadError(true);setNotice('Unable to load local events. Please try again.');}finally{setBusy(false);}}
 async function publish(e:FormEvent){e.preventDefault();if(busy||!userId)return;setBusy(true);setNotice('');
  try{
   const errorMessage=eventPublicationError({area,availableAreaIds:areas.map(a=>a.id),title,description,venue,start,end,nowMs:Date.now()});
   if(errorMessage){setNotice(errorMessage);return;}
   const begins=new Date(start),finishes=new Date(end);
   const {error}=await supabaseBrowser().from('community_events').insert({
    host_id:userId,area_id:area,title:title.trim(),description:description.trim(),
    venue_label:venue.trim(),starts_at:begins.toISOString(),ends_at:finishes.toISOString()
   });
   if(error)throw error;setTitle('');setDescription('');setVenue('');setStart('');setEnd('');setEndResetNotice('');
   // Publishing succeeded even if the follow-up listing refresh fails. Do not
   // invite a duplicate submission by reporting a successful insert as failed.
   try{await refresh();setNotice('Your event is published to signed-in community members.');}
   catch{setLoadError(true);setNotice('Your event was published, but upcoming events could not be refreshed. Please retry loading the list.');}
  }catch{setNotice('Unable to publish this event. Please check the details and try again.');}
  finally{setBusy(false);}
 }
 async function respond(id:string,status:'going'|'interested'|'none'){
  if(busy)return;setBusy(true);setPendingRsvpEventId(id);setNotice('');
  try{
   const {error}=await supabaseBrowser().rpc('set_event_response',{p_event:id,p_status:status});
   if(error)throw error;
   // A saved RSVP must not be reported as failed if the subsequent list refresh fails.
   try{await refresh();setNotice(status==='none'?'Your RSVP was cancelled.':'Your response has been saved.');}
   catch{setLoadError(true);setNotice('Your RSVP was saved, but upcoming events could not be refreshed. Please retry loading the list.');}
  }catch{setNotice('Unable to update your RSVP. Please try again.');}
  finally{setPendingRsvpEventId(null);setBusy(false);}
 }
 return <main className="container">
  <div className="page-heading"><span className="eyebrow">Bring neighbours together</span><h1>Local events</h1>
   <p className="subtle">Find and organise community meetups, projects and neighbourhood activities.</p></div>
  {notice&&<p className="notice" role="status">{notice}</p>}
  {loading?<p role="status">Loading local events…</p>:loadError&&!userId?<div className="card" role="alert"><p>We could not check your account or load neighbourhoods. Please try again before signing in.</p><button className="btn secondary" type="button" onClick={()=>window.location.reload()}>Retry loading local events</button></div>:!userId?<Link href="/account" className="btn">Sign in</Link>:<div className="two-col">
   <section className="card"><h2>Organise an event</h2>
    {areas.length===0&&<p role="status" className="muted-note">No neighbourhoods are available to select yet. Event publishing is unavailable until a neighbourhood is listed.</p>}
    <form className="form" onSubmit={publish}>
     <label>Neighbourhood<select required value={area} onChange={e=>setArea(e.target.value)}>
      <option value="">Choose neighbourhood</option>{areas.map(a=><option key={a.id} value={a.id}>{a.area_name}, {a.city}</option>)}
     </select></label>
     <label>Event title<input minLength={5} maxLength={120} required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Saturday neighbourhood clean-up"/></label>
     <label>About the event<textarea minLength={15} maxLength={2000} required value={description} onChange={e=>setDescription(e.target.value)}/></label>
     <label>Public meeting place<input minLength={3} maxLength={160} required aria-describedby="event-venue-privacy-help" value={venue} onChange={e=>setVenue(e.target.value)} placeholder="Community centre"/></label>
     <p id="event-venue-privacy-help" className="muted-note">This meeting place is visible to community members. Use a public venue, not your home address or another private address.</p>
     <label>Starts<input type="datetime-local" required value={start} onChange={e=>{const next=e.target.value;setStart(next);if(end&&next&&end<=next){setEnd('');setEndResetNotice('The finish time was cleared because it must be after the new start time. Choose a new finish time.');}else{setEndResetNotice('');}}}/></label>
     <label>Ends<input type="datetime-local" required min={start||undefined} aria-describedby={endResetNotice?'event-end-reset-notice':undefined} value={end} onChange={e=>{setEnd(e.target.value);setEndResetNotice('');}}/></label>
     {endResetNotice&&<p id="event-end-reset-notice" className="muted-note" role="status">{endResetNotice}</p>}
     <button className="btn" type="submit" disabled={busy||areas.length===0} aria-busy={busy}>Publish event</button>
    </form>
    <p className="muted-note">Dates are shown in your device's local time. Events are member-visible and require moderation before wider public launch.</p>
   </section>
   <section aria-labelledby="upcoming-events-heading"><h2 id="upcoming-events-heading">Upcoming events</h2>
    <div className="card" style={{marginBottom:14}}><h3>Find an event</h3><div className="form">
      <label htmlFor="event-search-keyword">Search upcoming events<input id="event-search-keyword" type="search" maxLength={120} value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="Try gardening or community centre"/></label>
      <label htmlFor="event-search-area">Neighbourhood<select id="event-search-area" value={searchArea} onChange={e=>setSearchArea(e.target.value)}><option value="">All listed neighbourhoods</option>{areas.map(a=><option key={a.id} value={a.id}>{a.area_name}, {a.city}</option>)}</select></label>
      <label htmlFor="event-search-time">When<select id="event-search-time" value={timeFilter} onChange={e=>setTimeFilter(e.target.value as EventTimeFilter)}><option value="all">Any upcoming date</option><option value="week">Next 7 days</option><option value="month">Next 30 days</option></select></label>
      <label htmlFor="event-search-rsvp">My RSVP<select id="event-search-rsvp" value={rsvpFilter} onChange={e=>setRsvpFilter(e.target.value as EventFilter)}><option value="all">All events</option><option value="going">I'm going</option><option value="interested">I'm interested</option></select></label>
      <button type="button" className="btn secondary" onClick={()=>{setSearchArea('');setKeyword('');setRsvpFilter('all');setTimeFilter('all');}}>Clear event filters</button>
    </div></div>{!loadError&&<p className="muted-note" role="status">{visibleEvents.length} of {events.length} upcoming {events.length===1?'event':'events'} matching your filters.{events.length>0?' RSVP controls are available for each event below.':''}</p>}{loadError&&<div role="alert"><p>Upcoming events could not be refreshed. The list is hidden until it can be checked again.</p><button className="btn secondary" type="button" disabled={busy} onClick={retryEvents}>Try loading events again</button></div>}<div className="list">
    {!loadError&&events.length===0&&<div className="card">No upcoming events. Why not organise one?</div>}
    {!loadError&&events.length>0&&visibleEvents.length===0&&<div className="card" role="status">No upcoming events match these filters. Try another neighbourhood, date or search term.</div>}
    {!loadError&&visibleEvents.map(e=>{const savedResponse=responses.find(a=>a.event_id===e.id)?.status;const r=savedResponse==='going'||savedResponse==='interested'?savedResponse:undefined;return <article className="card" key={e.id}>
     <span className="pill">{areas.find(a=>a.id===e.area_id)?.area_name||'Local event'}</span>
     <h3 id={`event-title-${e.id}`} style={{marginTop:12}}>{e.title}</h3>
     <p style={{marginBottom:9}}>{e.description}</p>
     <p><strong>Starts:</strong> <time dateTime={e.starts_at}>{new Date(e.starts_at).toLocaleString('en-GB')}</time></p>
     <p><strong>Ends:</strong> <time dateTime={e.ends_at}>{new Date(e.ends_at).toLocaleString('en-GB')}</time></p>
     <p><strong>Where:</strong> {e.venue_label}</p>
     {r&&<p id={`event-rsvp-${e.id}`} className="muted-note" role="status">Your RSVP: {r}</p>}
     <div role="group" aria-labelledby={`event-title-${e.id}`} aria-describedby={r?`event-rsvp-${e.id}`:undefined} aria-busy={pendingRsvpEventId===e.id} style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:14}}>
      <button className="btn" disabled={busy||r==='going'} aria-pressed={r==='going'} aria-label={`Going to ${e.title}`} onClick={()=>respond(e.id,'going')}>I'm going</button>
      <button className="btn secondary" disabled={busy||r==='interested'} aria-pressed={r==='interested'} aria-label={`Interested in ${e.title}`} onClick={()=>respond(e.id,'interested')}>Interested</button>
      {r&&<button className="btn secondary" disabled={busy} aria-label={`Cancel RSVP for ${e.title}`} onClick={()=>respond(e.id,'none')}>Cancel RSVP</button>}
      {pendingRsvpEventId===e.id&&<span role="status">Saving your RSVP…</span>}
     </div>
    </article>})}
   </div></section>
  </div>}
 </main>;
}
