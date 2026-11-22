'use client';
import {FormEvent,useEffect,useRef,useState} from 'react';
import {supabaseBrowser} from '../lib/supabase';
import {type SocialArea} from '../lib/social-discovery';
import {SOCIAL_ASSISTANCE_TYPES,socialTradeRequestError,type SocialTradeRequest,type SocialTradeInterest} from '../lib/social-trade-collaboration';

type Trade={id:string;name:string};
export default function SocialTradeCollaboration({userId,areas}:{userId:string;areas:SocialArea[]}){
 const [trades,setTrades]=useState<Trade[]>([]);
 const [selectedTrade,setSelectedTrade]=useState(''),[selectedArea,setSelectedArea]=useState('');
 const [assistanceType,setAssistanceType]=useState('specialist_support'),[earliestWeek,setEarliestWeek]=useState('');
 const [requests,setRequests]=useState<SocialTradeRequest[]>([]),[interests,setInterests]=useState<SocialTradeInterest[]>([]);
 const [filterTrade,setFilterTrade]=useState(''),[filterArea,setFilterArea]=useState('');
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[confirmClose,setConfirmClose]=useState(''),[refresh,setRefresh]=useState(0);
 const inFlight=useRef(false);
 useEffect(()=>{
  if(!userId){setLoading(false);return;}
  let active=true;
  (async()=>{
   try{
    const {data,error:readError}=await supabaseBrowser().from('trades')
     .select('id,name').order('name').limit(250);
    if(readError)throw readError;
    if(active)setTrades(data||[]);
   }catch{if(active)setError('Trade catalogue could not be loaded.');}
  })();
  return()=>{active=false;};
 },[userId]);

 useEffect(()=>{
  if(!userId){setLoading(false);return;}
  let active=true;
  (async()=>{
   setLoading(true);setError('');
   try{
    const s=supabaseBrowser();
    let request=s.from('social_trade_requests')
     .select('id,creator_id,trade_id,area_id,assistance_type,earliest_week,status,created_at')
     .order('created_at',{ascending:false}).limit(30);
    if(filterTrade)request=request.eq('trade_id',filterTrade);
    if(filterArea)request=request.eq('area_id',filterArea);
    const result=await request;
    if(result.error)throw result.error;
    if(!active)return;
    const rows=(result.data||[]) as SocialTradeRequest[];
    setRequests(rows);
    if(!rows.length){setInterests([]);return;}
    const i=await s.from('social_trade_interests')
     .select('request_id,responder_id,created_at').in('request_id',rows.map(row=>row.id)).limit(200);
    if(i.error)throw i.error;
    if(active)setInterests(i.data||[]);
   }catch{
    if(active){setRequests([]);setInterests([]);setError('Trade collaboration requests could not be loaded. Retry or check your professional registration.');}
   }finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[userId,filterTrade,filterArea,refresh]);

 async function create(event:FormEvent){
  event.preventDefault();
  if(inFlight.current)return;
  const problem=socialTradeRequestError({
   userId,tradeId:selectedTrade,tradeIds:trades.map(t=>t.id),
   areaId:selectedArea,areaIds:areas.map(a=>a.id),assistanceType,earliestWeek
  });
  if(problem){setNotice(problem);return;}
  inFlight.current=true;setBusy(true);setNotice('');
  try{
   const result=await supabaseBrowser().from('social_trade_requests').insert({
    creator_id:userId,trade_id:selectedTrade,area_id:selectedArea,assistance_type:assistanceType,
    earliest_week:earliestWeek||null,status:'open'
   });
   if(result.error)throw result.error;
   setSelectedTrade('');setSelectedArea('');setEarliestWeek('');
   setFilterArea('');setFilterTrade('');setRefresh(n=>n+1);
   setNotice('Collaboration request saved. Only eligible registered professionals can discover open requests. No private customer lead was shared.');
  }catch{setNotice('Request not saved. You must have an active professional application, and the request must pass server authorisation.');}
  finally{inFlight.current=false;setBusy(false);}
 }
 async function toggleInterest(request:SocialTradeRequest,alreadyInterested:boolean){
  if(inFlight.current||request.creator_id===userId||request.status!=='open')return;
  inFlight.current=true;setBusy(true);setNotice('');
  try{
   const s=supabaseBrowser();
   const result=alreadyInterested
    ?await s.from('social_trade_interests').delete().eq('request_id',request.id).eq('responder_id',userId)
    :await s.from('social_trade_interests').insert({request_id:request.id,responder_id:userId});
   if(result.error)throw result.error;
   setNotice(alreadyInterested?'Your expression of interest was withdrawn.':'Your expression of interest was recorded. Private messaging and customer-job sharing are not enabled here.');
   setRefresh(n=>n+1);
  }catch{setNotice('The request could not be updated. You must be an eligible registered professional and the request must remain open.');}
  finally{inFlight.current=false;setBusy(false);}
 }
 async function closeRequest(request:SocialTradeRequest){
  if(inFlight.current||request.creator_id!==userId||confirmClose!==request.id)return;
  inFlight.current=true;setBusy(true);setNotice('');
  try{
   const result=await supabaseBrowser().from('social_trade_requests')
    .update({status:'closed'}).eq('id',request.id).eq('creator_id',userId)
    .select('id,status').maybeSingle();
   if(result.error||result.data?.id!==request.id||result.data?.status!=='closed')
    throw Error('Request was not confirmed closed');
   setConfirmClose('');setRefresh(n=>n+1);
   setNotice('Your collaboration request was closed. If the list does not refresh, do not repeat the action.');
  }catch{setNotice('Could not close this request. Please retry after checking its current status.');}
  finally{inFlight.current=false;setBusy(false);}
 }
 return <section aria-labelledby="trade-collaboration-title" style={{marginTop:24}}>
  <h2 id="trade-collaboration-title">Professional collaboration requests</h2>
  <p className="subtle">A real, structured interest board for registered TrustFive applicants. A pending registration is not an approved professional, and activity here cannot affect the five-slot marketplace limit. There is no customer lead sharing, contact exchange or private messaging in this feature.</p>
  {!userId?<div className="card">Sign in to use the professional network.</div>:<>
   <div className="card" style={{marginBottom:18}}>
    <h3>Request professional assistance</h3>
    <p className="muted-note">Select only a trade, general service area, assistance type and optional date. Never include exact customer addresses or private job details; this form has no fields for them.</p>
    <form className="form" onSubmit={create}>
     <label>Required trade<select required value={selectedTrade} disabled={busy} onChange={e=>setSelectedTrade(e.target.value)}>
      <option value="">Choose a trade</option>{trades.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}
     </select></label>
     <label>General service area<select required value={selectedArea} disabled={busy} onChange={e=>setSelectedArea(e.target.value)}>
      <option value="">Choose a service area</option>{areas.map(a=><option value={a.id} key={a.id}>{a.area_name}, {a.city}</option>)}
     </select></label>
     <label>Assistance type<select value={assistanceType} disabled={busy} onChange={e=>setAssistanceType(e.target.value)}>
      {SOCIAL_ASSISTANCE_TYPES.map(([value,label])=><option value={value} key={value}>{label}</option>)}
     </select></label>
     <label>Earliest week (optional)<input type="date" value={earliestWeek} disabled={busy} onChange={e=>setEarliestWeek(e.target.value)}/></label>
     <button className="btn" type="submit" disabled={busy||Boolean(socialTradeRequestError({
      userId,tradeId:selectedTrade,tradeIds:trades.map(t=>t.id),areaId:selectedArea,
      areaIds:areas.map(a=>a.id),assistanceType,earliestWeek
     }))}>{busy?'Saving request…':'Create collaboration request'}</button>
    </form>
    <p className="muted-note">Server policy requires a genuinely registered professional application. Your ability to create a request does not imply marketplace approval or access to protected leads.</p>
   </div>
   <section aria-label="Discover professional assistance requests">
    <h3>Discover open requests</h3>
    <div className="card social-hub-filters">
     <label>Trade<select value={filterTrade} onChange={e=>setFilterTrade(e.target.value)}>
      <option value="">All trades</option>{trades.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
     </select></label>
     <label>Service area<select value={filterArea} onChange={e=>setFilterArea(e.target.value)}>
      <option value="">All service areas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.area_name}, {a.city}</option>)}
     </select></label>
     <button type="button" className="btn secondary" onClick={()=>setRefresh(n=>n+1)}>Refresh requests</button>
    </div>
    {notice&&<p className="notice" role="status">{notice}</p>}
    {loading?<p className="card" role="status">Loading registered professionals' requests…</p>
     :error?<div className="card" role="alert"><p>{error}</p><button type="button" className="btn secondary" onClick={()=>setRefresh(n=>n+1)}>Retry requests</button></div>
     :<div className="list">
      {!requests.length&&<p className="card">No collaboration requests are available for your account and filters.</p>}
      {requests.map(request=>{
       const mine=request.creator_id===userId;
       const interested=interests.some(item=>item.request_id===request.id&&item.responder_id===userId);
       return <article className="card" key={request.id}>
        <span className="pill">{request.status==='closed'?'Closed request':'Open request'}</span>
        <h4 style={{marginTop:10}}>{trades.find(t=>t.id===request.trade_id)?.name||'Trade required'}</h4>
        <p>{SOCIAL_ASSISTANCE_TYPES.find(([key])=>key===request.assistance_type)?.[1]||'Professional assistance'} · {areas.find(a=>a.id===request.area_id)?.area_name||'General service area'}</p>
        {request.earliest_week&&<p className="muted-note">Earliest suggested date: {request.earliest_week}</p>}
        {mine?<div>
         <p className="muted-note">Your request. Expressions of interest are recorded privately; private messaging is not yet enabled.</p>
         {request.status==='open'&&(confirmClose===request.id?
          <div className="social-hub-shortcuts" role="group" aria-label="Confirm closing request">
           <button type="button" className="btn" disabled={busy} onClick={()=>{void closeRequest(request);}}>Confirm close</button>
           <button type="button" className="btn secondary" disabled={busy} onClick={()=>setConfirmClose('')}>Keep open</button>
          </div>:
          <button type="button" className="btn secondary" disabled={busy} onClick={()=>setConfirmClose(request.id)}>Close request</button>)}
        </div>:request.status==='open'?<button type="button" className="btn secondary" disabled={busy} aria-pressed={interested}
           onClick={()=>{void toggleInterest(request,interested);}}>{interested?'Withdraw interest':'Express interest'}</button>:null}
       </article>;
      })}
      {requests.length===30&&<p className="muted-note">Showing up to 30 recent requests. Apply filters to narrow the list.</p>}
     </div>}
   </section>
  </>}
 </section>;
}
