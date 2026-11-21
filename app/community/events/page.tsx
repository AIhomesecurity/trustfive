'use client';
import {FormEvent,useEffect,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../../lib/supabase';
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
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [pendingRsvpEventId,setPendingRsvpEventId]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [loadError,setLoadError]=useState(false);
 async function refresh(){
  const s=supabaseBrowser();
  const [e,r]=await Promise.all([
   s.from('community_events').select('id,area_id,title,description,venue_label,starts_at,ends_at,host_id')
    .eq('visibility','published').gte('ends_at',new Date().toISOString()).order('starts_at').limit(100),
   s.from('community_event_rsvps').select('event_id,status')
  ]);
  if(e.error)throw e.error;if(r.error)throw r.error;
  setEvents(e.data||[]);setResponses(r.data||[]);setLoadError(false);
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
   if(!areas.some(a=>a.id===area)||title.trim().length<5||description.trim().length<15||venue.trim().length<3){
    setNotice('Choose a neighbourhood and enter a meaningful title, description and public meeting place.');return;
   }
   const begins=new Date(start),finishes=new Date(end);
   if(!Number.isFinite(begins.getTime())||!Number.isFinite(finishes.getTime())
    ||begins<=new Date()||finishes<=begins)throw Error('Choose a future event with a valid end time.');
   const {error}=await supabaseBrowser().from('community_events').insert({
    host_id:userId,area_id:area,title:title.trim(),description:description.trim(),
    venue_label:venue.trim(),starts_at:begins.toISOString(),ends_at:finishes.toISOString()
   });
   if(error)throw error;setTitle('');setDescription('');setVenue('');setStart('');setEnd('');setEndResetNotice('');
   // Publishing succeeded even if the follow-up listing refresh fails. Do not
   // invite a duplicate submission by reporting a successful insert as failed.
   try{await refresh();setNotice('Your event is published to signed-in community members.');}
   catch{setLoadError(true);setNotice('Your event was published, but upcoming events could not be refreshed. Please retry loading the list.');}
  }catch(e){setNotice(e instanceof Error&&e.message==='Choose a future event with a valid end time.'?e.message:'Unable to publish this event. Please check the details and try again.');}
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
     <label>Meeting place (public; avoid private addresses)<input minLength={3} maxLength={160} required value={venue} onChange={e=>setVenue(e.target.value)} placeholder="Community centre"/></label>
     <label>Starts<input type="datetime-local" required value={start} onChange={e=>{const next=e.target.value;setStart(next);if(end&&next&&end<=next){setEnd('');setEndResetNotice('The finish time was cleared because it must be after the new start time. Choose a new finish time.');}else{setEndResetNotice('');}}}/></label>
     <label>Ends<input type="datetime-local" required min={start||undefined} value={end} onChange={e=>{setEnd(e.target.value);setEndResetNotice('');}}/></label>
     {endResetNotice&&<p className="muted-note" role="status">{endResetNotice}</p>}
     <button className="btn" type="submit" disabled={busy||areas.length===0} aria-busy={busy}>Publish event</button>
    </form>
    <p className="muted-note">Dates are shown in your device's local time. Events are member-visible and require moderation before wider public launch.</p>
   </section>
   <section><h2>Upcoming events</h2>{loadError&&<div role="alert"><p>Upcoming events could not be refreshed. The list is hidden until it can be checked again.</p><button className="btn secondary" type="button" disabled={busy} onClick={retryEvents}>Try loading events again</button></div>}<div className="list">
    {!loadError&&events.length===0&&<div className="card">No upcoming events. Why not organise one?</div>}
    {!loadError&&events.map(e=>{const savedResponse=responses.find(a=>a.event_id===e.id)?.status;const r=savedResponse==='going'||savedResponse==='interested'?savedResponse:undefined;return <article className="card" key={e.id}>
     <span className="pill">{areas.find(a=>a.id===e.area_id)?.area_name||'Local event'}</span>
     <h3 id={`event-title-${e.id}`} style={{marginTop:12}}>{e.title}</h3>
     <p style={{marginBottom:9}}>{e.description}</p>
     <p><strong>Starts:</strong> <time dateTime={e.starts_at}>{new Date(e.starts_at).toLocaleString('en-GB')}</time></p>
     <p><strong>Ends:</strong> <time dateTime={e.ends_at}>{new Date(e.ends_at).toLocaleString('en-GB')}</time></p>
     <p><strong>Where:</strong> {e.venue_label}</p>
     {r&&<p className="muted-note">Your RSVP: {r}</p>}
     <div role="group" aria-labelledby={`event-title-${e.id}`} aria-busy={pendingRsvpEventId===e.id} style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:14}}>
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
