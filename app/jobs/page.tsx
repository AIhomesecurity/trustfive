'use client';
import {FormEvent,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import AddressSearch,{type SelectedLocation} from '../../components/address-search';
import {jobAddressLabel} from '../../lib/job-address';
import {parseJobBudgetPence} from '../../lib/job-budget';
import {meaningfulJobTextLength} from '../../lib/job-text';
import {jobPublishBlocker} from '../../lib/job-publish-readiness';
import TradeQuickPick from '../../components/trade-quick-pick';
import {acceptedQuoteBookingHref,canConfirmJobQuote} from '../../lib/quote-confirmation';
import {quoteMessagesHref} from '../../lib/workflow-links';
import {
  CONTACT_PREFERENCE_OPTIONS,
  readableContactPreference,
  sortCustomerQuotes,
  summarizeJobQuotes,
  type ContactPreference,
  type QuoteSortMode,
} from '../../lib/quote-comparison';
import {
  canCancelCustomerJob,
  canReopenCustomerJob,
  normalizeJobActivity,
  readableJobStatus,
  validateCancelReason,
  type JobActivityEvent,
  type NormalizedJobActivityEvent,
} from '../../lib/job-lifecycle';

type Trade={id:string;name:string;slug:string};
type Area={id:string;area_name:string;city:string};
type Job={id:string;title:string;description:string;status:string;created_at:string;budget_pence:number|null;contact_preference?:string|null};
type Quote={quote_id:string;job_id:string;business_name:string;amount_pence:number;message:string;availability_note?:string|null;status:string;created_at?:string};

const money=(pence:number)=>'£'+(pence/100).toFixed(2);

export default function Jobs(){
 const [jobs,setJobs]=useState<Job[]>([]),[quotes,setQuotes]=useState<Quote[]>([]),[trades,setTrades]=useState<Trade[]>([]),[areas,setAreas]=useState<Area[]>([]);
 const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[trade,setTrade]=useState(''),[area,setArea]=useState(''),[budget,setBudget]=useState('');
 const [contactPreference,setContactPreference]=useState<ContactPreference>('in_app_messages');
 const [quoteSort,setQuoteSort]=useState<QuoteSortMode>('lowest_price');
 const [userId,setUserId]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[initialLoading,setInitialLoading]=useState(true);
 const [confirmedBookingHref,setConfirmedBookingHref]=useState('');
 const [confirmQuoteId,setConfirmQuoteId]=useState<string|null>(null);
 const [confirmCancelJobId,setConfirmCancelJobId]=useState<string|null>(null);
 const [cancelReason,setCancelReason]=useState('');
 const [confirmReopenJobId,setConfirmReopenJobId]=useState<string|null>(null);
 const [activityJobId,setActivityJobId]=useState<string|null>(null);
 const [activityEvents,setActivityEvents]=useState<NormalizedJobActivityEvent[]>([]);
 const [activityLoading,setActivityLoading]=useState(false);
 const [activityError,setActivityError]=useState('');
 const [site,setSite]=useState<SelectedLocation|null>(null),[checkedSite,setCheckedSite]=useState<SelectedLocation|null>(null),[addressVersion,setAddressVersion]=useState(0);
 const [manualProperty,setManualProperty]=useState('');
 const [territoryRetry,setTerritoryRetry]=useState(0),[territoryFailed,setTerritoryFailed]=useState(false);
 const [territoryVerified,setTerritoryVerified]=useState(false),[territoryChecking,setTerritoryChecking]=useState(false),[territoryNotice,setTerritoryNotice]=useState(''),[manualFallbackAllowed,setManualFallbackAllowed]=useState(false);

 const actionInFlight=useRef(false);
 const activityRequest=useRef(0);

 const publishBlocker=jobPublishBlocker({title,description,trade,site,manualProperty,area,budget,busy,territoryChecking,checkedSite,territoryVerified,manualFallbackAllowed});
 const step1Done=meaningfulJobTextLength(title)>=5&&meaningfulJobTextLength(description)>=15&&Boolean(trade);
 const step2Done=Boolean(site&&checkedSite===site&&!territoryChecking&&(territoryVerified||manualFallbackAllowed)&&area&&(site.precision!=='postcode'||manualProperty.trim().length>=5));
 const step3Done=!publishBlocker;

 async function refresh(){
  const s=supabaseBrowser();
  const [j,q]=await Promise.all([
   s.from('jobs').select('id,title,description,status,created_at,budget_pence,contact_preference').order('created_at',{ascending:false}).limit(100),
   s.rpc('customer_quotes')
  ]);
  if(j.error)throw j.error;
  if(q.error)throw q.error;
  setJobs((j.data||[]) as Job[]);
  setQuotes((q.data||[]) as Quote[]);
 }

 async function loadJobActivity(jobId:string){
  const reqId=++activityRequest.current;
  setActivityJobId(jobId);
  setActivityLoading(true);
  setActivityError('');
  try{
   const {data,error}=await supabaseBrowser().rpc('customer_job_activity',{p_job:jobId});
   if(error)throw error;
   if(reqId===activityRequest.current){
    setActivityEvents(normalizeJobActivity((data||[]) as JobActivityEvent[]));
   }
  }catch(e){
   if(reqId===activityRequest.current){
    setActivityEvents([]);
    setActivityError(e instanceof Error?e.message:'Unable to load job activity');
   }
  }finally{
   if(reqId===activityRequest.current)setActivityLoading(false);
  }
 }

 function toggleJobActivity(jobId:string){
  if(activityJobId===jobId){
   activityRequest.current+=1;
   setActivityJobId(null);
   setActivityEvents([]);
   setActivityError('');
   setActivityLoading(false);
   return;
  }
  void loadJobActivity(jobId);
 }

 useEffect(()=>{(async()=>{try{
  const s=supabaseBrowser();
  const [u,t,a]=await Promise.all([
   s.auth.getUser(),
   s.from('trades').select('id,name,slug').order('name'),
   s.from('service_areas').select('id,area_name,city').order('city')
  ]);
  if(!u.data.user){setMessage('Sign in to post and manage jobs.');return}
  setUserId(u.data.user.id);
  if(t.error)throw t.error;
  if(a.error)throw a.error;
  setTrades(t.data||[]);setAreas(a.data||[]);
  const params=new URLSearchParams(window.location.search);
  const requestedTrade=params.get('trade')||'';
  const requestedArea=params.get('area')||'';
  const matchedTrade=(t.data||[]).find(item=>item.slug===requestedTrade);
  if(matchedTrade)setTrade(matchedTrade.id);
  if((a.data||[]).some(item=>item.id===requestedArea))setArea(requestedArea);
  await refresh();
 }catch(e){setMessage(e instanceof Error?e.message:'Could not load jobs')}finally{setInitialLoading(false)}})()},[]);

 useEffect(()=>{
  let active=true;
  if(!site){setCheckedSite(null);setTerritoryFailed(false);setTerritoryVerified(false);setManualFallbackAllowed(false);setTerritoryNotice('');setTerritoryChecking(false);setArea('');return;}
  setCheckedSite(null);setTerritoryFailed(false);setTerritoryChecking(true);setTerritoryVerified(false);setManualFallbackAllowed(false);setTerritoryNotice('Checking verified TrustFive territory coverage…');setArea('');
  (async()=>{
   try{
    const {data,error}=await supabaseBrowser().rpc('resolve_trustfive_territory',{
     p_country:site.country,p_lat:site.latitude,p_lon:site.longitude
    });
    if(!active)return;
    if(error)throw error;
    if(data&&areas.some(a=>a.id===data)){
     setArea(data);setCheckedSite(site);setTerritoryVerified(true);setManualFallbackAllowed(false);
     setTerritoryNotice('Verified territory selected automatically from your address.');
    }else{
     const coverage=await supabaseBrowser().rpc('has_verified_trustfive_territories',{p_country:site.country});
     if(!active)return;
     if(coverage.error)throw coverage.error;
     if(coverage.data){
      setManualFallbackAllowed(false);
      setTerritoryNotice('This address is outside currently verified TrustFive territory boundaries. Job posting is not available here yet; please check back when local coverage expands.');
     }else{
      setManualFallbackAllowed(true);setCheckedSite(site);
      setTerritoryNotice('There are no reviewed TrustFive boundaries for this country yet. You may temporarily select a territory manually; we cannot independently verify that it matches your address.');
     }
    }
   }catch{
    if(active){setTerritoryFailed(true);setManualFallbackAllowed(false);setTerritoryNotice('Territory verification is unavailable. For your protection, job publishing is paused until it can be checked.');}
   }finally{if(active)setTerritoryChecking(false);}
  })();
  return()=>{active=false;};
 },[site,areas,territoryRetry]);

 async function submit(e:FormEvent){
  e.preventDefault();
  if(!userId||busy||actionInFlight.current)return;
  if(publishBlocker){setMessage(publishBlocker);return;}
  actionInFlight.current=true;setBusy(true);setMessage('');
  try{
   if(meaningfulJobTextLength(title)<5)throw Error('Enter a job title with at least 5 meaningful characters');
   if(meaningfulJobTextLength(description)<15)throw Error('Describe the work in at least 15 meaningful characters');
   if(!site)throw Error('Select your job-site address from the suggestions first');
   const privateAddress=jobAddressLabel(site,manualProperty);
   if(territoryChecking||checkedSite!==site)throw Error('Wait for territory verification of your current address to finish');
   if(!territoryVerified&&!manualFallbackAllowed)throw Error('This address is not currently eligible for posting, or territory verification is unavailable');
   const amount=parseJobBudgetPence(budget);
   const s=supabaseBrowser();
   const {data:createdJobId,error}=await s.rpc('create_job_with_private_location',{
    p_title:title.trim(),p_description:description.trim(),p_trade:trade,p_area:area,p_budget_pence:amount,
    p_address:privateAddress,p_postcode:site.postcode,p_country:site.country,
    p_lat:site.latitude,p_lon:site.longitude,p_precision:site.precision
   });
   if(error)throw error;
   if(createdJobId&&contactPreference!=='in_app_messages'){
    const prefRes=await s.rpc('set_job_contact_preference',{
     p_job:createdJobId,
     p_preference:contactPreference
    });
    if(prefRes.error){
     setMessage('Job published, but contact preference stayed on TrustFive messages. You can review your job below.');
    }
   }
   setTitle('');setDescription('');setBudget('');setContactPreference('in_app_messages');
   setSite(null);setCheckedSite(null);setManualProperty('');setTerritoryVerified(false);setAddressVersion(v=>v+1);
   try{
    await refresh();
    setMessage('Job published. Your selected address is stored privately and is not shown in public job descriptions. Only eligible approved professionals covering your service territory can view the brief.');
   }catch{
    setMessage('Job published successfully, but your job list could not be refreshed. Reload this page to see it before posting again.');
   }
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to save')}
  finally{actionInFlight.current=false;setBusy(false)}
 }

 async function accept(quoteId:string){
  if(busy||actionInFlight.current||confirmQuoteId!==quoteId)return;
  if(!canConfirmJobQuote(quoteId,quotes,jobs)){setConfirmQuoteId(null);setMessage('This quote can no longer be accepted. Refresh your jobs and try again.');return;}
  actionInFlight.current=true;setBusy(true);setMessage('');
  try{
   const {data,error}=await supabaseBrowser().rpc('accept_job_quote',{p_quote:quoteId});
   if(error)throw error;
   const acceptedJobId=quotes.find(quote=>quote.quote_id===quoteId)?.job_id;
   setConfirmedBookingHref(acceptedQuoteBookingHref(data));
   setConfirmQuoteId(null);
   setJobs(current=>current.map(job=>job.id===acceptedJobId?{...job,status:'booked'}:job));
   setQuotes(current=>current.map(quote=>quote.job_id===acceptedJobId&&quote.status==='pending'
    ?{...quote,status:quote.quote_id===quoteId?'accepted':'rejected'}:quote));
   try{
    await refresh();
    setMessage('Quote accepted and booking recorded. No payment has been taken. Agree appointment and address-sharing details through your booking and messages.');
   }catch{
    setMessage('Booking recorded successfully. The jobs list could not be refreshed. Open the booking to continue. No payment has been taken.');
   }
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to accept quote')}
  finally{actionInFlight.current=false;setBusy(false)}
 }

 async function cancelJob(job:Job){
  if(busy||actionInFlight.current||confirmCancelJobId!==job.id)return;
  if(!canCancelCustomerJob(job)){
   setConfirmCancelJobId(null);
   setMessage('Only unbooked draft or open jobs can be cancelled.');
   return;
  }
  const reasonError=validateCancelReason(cancelReason);
  if(reasonError){setMessage(reasonError);return;}
  actionInFlight.current=true;setBusy(true);setMessage('');
  try{
   const {error}=await supabaseBrowser().rpc('cancel_customer_job',{
    p_job:job.id,
    p_reason:cancelReason.trim()||null
   });
   if(error)throw error;
   setConfirmCancelJobId(null);
   setCancelReason('');
   // Committed in DB; isolate list refresh so a refresh failure never looks like a failed cancellation.
   try{
    await refresh();
    if(activityJobId===job.id)await loadJobActivity(job.id);
    setMessage('Job cancelled. Pending quotes on this job are no longer open for acceptance.');
   }catch{
    setMessage('Job cancelled successfully, but your job list could not be refreshed. Reload this page to confirm the updated status.');
   }
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to cancel job');}
  finally{actionInFlight.current=false;setBusy(false);}
 }

 async function reopenJob(job:Job){
  if(busy||actionInFlight.current||confirmReopenJobId!==job.id)return;
  if(!canReopenCustomerJob(job)){
   setConfirmReopenJobId(null);
   setMessage('Only cancelled unbooked jobs can be reopened.');
   return;
  }
  actionInFlight.current=true;setBusy(true);setMessage('');
  try{
   const {error}=await supabaseBrowser().rpc('reopen_customer_job',{p_job:job.id});
   if(error)throw error;
   setConfirmReopenJobId(null);
   try{
    await refresh();
    if(activityJobId===job.id)await loadJobActivity(job.id);
    setMessage('Job reopened. Eligible local approved professionals can now see the brief again.');
   }catch{
    setMessage('Job reopened successfully, but your job list could not be refreshed. Reload this page to confirm the updated status.');
   }
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to reopen job');}
  finally{actionInFlight.current=false;setBusy(false);}
 }

 return <main className="container">
  <div className="page-heading">
   <span className="eyebrow">Customer marketplace</span>
   <h1>My jobs and quotes</h1>
   <p className="subtle">Post a job step-by-step, manage open or cancelled requests, inspect genuine activity history, and compare quotations from independently approved local professionals.</p>
  </div>
  {message&&<p className="notice" role="status">{message}</p>}
  {confirmedBookingHref&&userId&&<p><Link className="btn" href={confirmedBookingHref}>Open your confirmed booking →</Link></p>}
  {initialLoading?<p className="notice" role="status" aria-live="polite">Checking your account and loading jobs…</p>:
  !userId?<Link className="btn" href={'/account?next='+encodeURIComponent(typeof window==='undefined'?'/jobs':window.location.pathname+window.location.search)}>Sign in / create account</Link>:
  <div className="two-col">
   <section className="card">
    <h2>Post a job</h2>
    <ol aria-label="Job posting progress" style={{display:'flex',gap:8,flexWrap:'wrap',listStyle:'none',padding:0,margin:'0 0 18px'}}>
     <li className="pill">{step1Done?'✓':'1.'} Trade &amp; scope</li>
     <li className="pill">{step2Done?'✓':'2.'} Location &amp; territory</li>
     <li className="pill">{step3Done?'✓':'3.'} Contact &amp; publish</li>
    </ol>
    <form className="form" onSubmit={submit}>
     <fieldset style={{border:'1px solid var(--border)',borderRadius:12,padding:14,margin:0}}>
      <legend style={{fontWeight:800,padding:'0 6px'}}>Step 1 · Trade &amp; work scope</legend>
      <div className="form">
       <label>Job title<input required minLength={5} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Fix leaking kitchen tap"/></label>
       <label>What needs doing?<textarea required minLength={15} maxLength={3000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the work, access and materials. Do not include private contact details."/></label>
       <TradeQuickPick trades={trades} value={trade} onChange={setTrade}/>
       <label>Trade<select required value={trade} onChange={e=>setTrade(e.target.value)}><option value="">Choose a service</option>{trades.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label>
      </div>
     </fieldset>

     <fieldset style={{border:'1px solid var(--border)',borderRadius:12,padding:14,margin:0}}>
      <legend style={{fontWeight:800,padding:'0 6px'}}>Step 2 · Private job-site location</legend>
      <div className="form">
       <AddressSearch key={addressVersion} onSelect={point=>{setCheckedSite(null);setArea('');setTerritoryVerified(false);setManualFallbackAllowed(false);setSite(point);setManualProperty('');}}/>
       {site?.precision==='postcode'&&<label>House number/name and street (private, required)<input required minLength={5} maxLength={100} autoComplete="address-line1" value={manualProperty} onChange={e=>setManualProperty(e.target.value)} placeholder="e.g. 14 High Street" aria-describedby="postcode-location-note"/><span id="postcode-location-note" className="muted-note">We will store this with your postcode as your private job address. The map position remains the approximate postcode centre, not your property's exact coordinates.</span></label>}
       <label>TrustFive service territory {territoryVerified?'(verified automatically)':'(temporary manual selection)'}<select required disabled={territoryVerified||territoryChecking||!manualFallbackAllowed} value={area} onChange={e=>setArea(e.target.value)}><option value="">Choose an area</option>{areas.map(a=><option value={a.id} key={a.id}>{a.area_name}, {a.city}</option>)}</select></label>
       {site&&territoryNotice&&<div className={territoryFailed?'notice error':'notice'} role="status" aria-live="polite"><p>{territoryNotice}</p>{territoryFailed&&<button type="button" className="btn secondary" disabled={territoryChecking} onClick={()=>setTerritoryRetry(v=>v+1)}>Retry territory verification</button>}</div>}
      </div>
     </fieldset>

     <fieldset style={{border:'1px solid var(--border)',borderRadius:12,padding:14,margin:0}}>
      <legend style={{fontWeight:800,padding:'0 6px'}}>Step 3 · Budget &amp; contact preference</legend>
      <div className="form">
       <label>Estimated budget (£; optional)<input type="number" min="0" max="10000000" step="0.01" value={budget} onChange={e=>setBudget(e.target.value)} placeholder="250"/></label>
       <label>How would you prefer to be contacted?
        <select value={contactPreference} onChange={e=>setContactPreference(e.target.value as ContactPreference)}>
         {CONTACT_PREFERENCE_OPTIONS.map(opt=><option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <span className="muted-note">{CONTACT_PREFERENCE_OPTIONS.find(o=>o.value===contactPreference)?.hint}</span>
       </label>
      </div>
     </fieldset>

     <button disabled={Boolean(publishBlocker)} aria-describedby="job-publish-guidance" className="btn" type="submit">{busy?'Saving…':'Publish job request'}</button>
     <p id="job-publish-guidance" className="muted-note" aria-live="polite">{publishBlocker||'Your job request is ready to publish.'}</p>
    </form>
    <p style={{marginTop:18}} className="muted-note">Choose your property from the address suggestions. If only a postcode is available, enter your house number/name and street separately. The postcode-centre coordinates remain approximate. Your selected address is stored privately; do not repeat it in your public description.</p>
   </section>

   <section>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:12}}>
     <h2 style={{margin:0}}>Your job requests &amp; quotes</h2>
     <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:700}}>
      Sort quotes
      <select style={{width:'auto',padding:'6px 10px'}} value={quoteSort} onChange={e=>setQuoteSort(e.target.value as QuoteSortMode)}>
       <option value="lowest_price">Lowest price first</option>
       <option value="newest">Newest first</option>
      </select>
     </label>
    </div>
    <div className="list">
     {jobs.length===0?<div className="card">You haven't posted any jobs yet.</div>:jobs.map(j=>{
      const jobQuotes=sortCustomerQuotes(quotes.filter(q=>q.job_id===j.id),quoteSort);
      const summary=summarizeJobQuotes(jobQuotes);
      const showCancel=canCancelCustomerJob(j);
      const showReopen=canReopenCustomerJob(j);
      const activityOpen=activityJobId===j.id;
      return <article className="card" key={j.id}>
       <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <span className="pill">{readableJobStatus(j.status)}</span>
        {summary.total>0&&<span className="muted-note">
         {summary.total} quote{summary.total===1?'':'s'}
         {summary.lowestPence!==null&&summary.highestPence!==null
          ?` · ${money(summary.lowestPence)}${summary.highestPence>summary.lowestPence?`–${money(summary.highestPence)}`:''}`
          :' · no active quotes'}
        </span>}
       </div>
       <h3 style={{marginTop:10}}>{j.title}</h3>
       <p>{j.description}</p>
       {j.budget_pence!==null&&<p style={{marginTop:10}}>Budget estimate: {money(j.budget_pence)}</p>}
       <p className="muted-note" style={{marginTop:8}}>
        {new Date(j.created_at).toLocaleDateString('en-GB')} · Contact: {readableContactPreference(j.contact_preference)}
       </p>

       <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>
        <button type="button" className="btn secondary" aria-expanded={activityOpen} onClick={()=>toggleJobActivity(j.id)}>
         {activityOpen?'Hide job activity':'View job activity'}
        </button>
        {showCancel&&confirmCancelJobId!==j.id&&
         <button type="button" className="btn secondary" disabled={busy} onClick={()=>{setConfirmCancelJobId(j.id);setConfirmReopenJobId(null);setCancelReason('');setMessage('');}}>
          Cancel job
         </button>}
        {showReopen&&confirmReopenJobId!==j.id&&
         <button type="button" className="btn secondary" disabled={busy} onClick={()=>{setConfirmReopenJobId(j.id);setConfirmCancelJobId(null);setMessage('');}}>
          Reopen job
         </button>}
       </div>

       {showCancel&&confirmCancelJobId===j.id&&
        <div className="notice" style={{marginTop:12}} role="group" aria-label={'Confirm cancelling job '+j.title}>
         <h4>Cancel “{j.title}”?</h4>
         <p className="muted-note">Cancelling closes this unbooked request and stops pending quotes from being accepted. You can reopen it later if no booking exists.</p>
         <label style={{marginTop:10}}>Optional note (max 240 chars)
          <input maxLength={240} value={cancelReason} onChange={e=>setCancelReason(e.target.value)} placeholder="e.g. Postponing work until next month"/>
         </label>
         <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
          <button type="button" className="btn" disabled={busy} onClick={()=>void cancelJob(j)}>{busy?'Cancelling…':'Confirm cancel job'}</button>
          <button type="button" className="btn secondary" disabled={busy} onClick={()=>{setConfirmCancelJobId(null);setCancelReason('');}}>Keep job open</button>
         </div>
        </div>}

       {showReopen&&confirmReopenJobId===j.id&&
        <div className="notice" style={{marginTop:12}} role="group" aria-label={'Confirm reopening job '+j.title}>
         <h4>Reopen “{j.title}”?</h4>
         <p className="muted-note">Reopening makes this unbooked job visible again to eligible local approved professionals in your verified territory.</p>
         <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
          <button type="button" className="btn" disabled={busy} onClick={()=>void reopenJob(j)}>{busy?'Reopening…':'Confirm reopen job'}</button>
          <button type="button" className="btn secondary" disabled={busy} onClick={()=>setConfirmReopenJobId(null)}>Keep cancelled</button>
         </div>
        </div>}

       {activityOpen&&
        <div className="notice" style={{marginTop:12}} aria-live="polite" aria-busy={activityLoading}>
         <h4>Job activity history</h4>
         {activityLoading?<p className="muted-note">Loading genuine job activity…</p>:
          activityError?<><p>{activityError}</p><button type="button" className="btn secondary" onClick={()=>void loadJobActivity(j.id)}>Retry activity load</button></>:
          activityEvents.length===0?<p className="muted-note">No lifecycle events recorded yet.</p>:
          <ol style={{paddingLeft:18,margin:'8px 0 0'}}>
           {activityEvents.map(ev=><li key={ev.event_id} style={{marginBottom:4}}>
            <strong>{ev.label}</strong> <span className="muted-note">· {new Date(ev.created_at).toLocaleString('en-GB')}</span>
           </li>)}
          </ol>}
        </div>}

       {jobQuotes.map(q=><div key={q.quote_id} className="notice">
        <span className="pill">{q.status} quote</span>
        <h3>{q.business_name}</h3>
        <p><strong>{money(q.amount_pence)}</strong></p>
        {q.status==='withdrawn'&&<p className="muted-note" style={{marginTop:4}}>This quote was withdrawn and is no longer available to accept.</p>}
        {q.availability_note&&<p className="muted-note" style={{marginTop:4}}><strong>Availability:</strong> {q.availability_note}</p>}
        <p style={{marginTop:6}}>{q.message}</p>
        <p style={{marginTop:12}}><Link href={quoteMessagesHref(q.quote_id)}>Message this professional →</Link></p>
        {j.status==='open'&&q.status==='pending'&&(
         confirmQuoteId===q.quote_id?
         <div className="quote-confirmation" role="group" aria-label={'Confirm quote from '+q.business_name}>
          <h4>Confirm this booking?</h4>
          <p>You are choosing <strong>{q.business_name}</strong> for <strong>{money(q.amount_pence)}</strong> for “{j.title}”.</p>
          <p className="muted-note">Confirming creates a TrustFive booking. No payment is collected here. Agree the work, timing and terms with the professional. Your exact job address stays private unless you separately choose to share it for the booking.</p>
          <div className="quote-confirmation-actions">
           <button type="button" className="btn" disabled={busy} onClick={()=>void accept(q.quote_id)}>{busy?'Confirming…':'Confirm and create booking'}</button>
           <button type="button" className="btn secondary" disabled={busy} onClick={()=>setConfirmQuoteId(null)}>Cancel</button>
          </div>
         </div>:
         <button type="button" disabled={busy} className="btn" onClick={()=>{setConfirmQuoteId(q.quote_id);setMessage('');}}>Review and accept quote</button>
        )}
       </div>)}
       {j.status==='booked'&&<p style={{marginTop:12}}><Link href="/bookings">Manage confirmed booking →</Link></p>}
      </article>;
     })}
    </div>
   </section>
  </div>}
 </main>;
}
