'use client';
import {FormEvent,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import AddressSearch,{type SelectedLocation} from '../../components/address-search';
import CustomerJobCard,{
  type CustomerJobRecord,
  type CustomerQuoteRecord,
  type JobActivityDrawerState,
} from '../../components/customer-job-card';
import {jobAddressLabel} from '../../lib/job-address';
import {parseJobBudgetPence} from '../../lib/job-budget';
import {meaningfulJobTextLength} from '../../lib/job-text';
import {jobPublishBlocker} from '../../lib/job-publish-readiness';
import TradeQuickPick from '../../components/trade-quick-pick';
import {canConfirmJobQuote} from '../../lib/quote-confirmation';
import {
  CONTACT_PREFERENCE_OPTIONS,
  sortCustomerQuotes,
  type ContactPreference,
  type QuoteSortMode,
} from '../../lib/quote-comparison';
import {
  applyCommittedJobCancellation,
  applyCommittedJobReopen,
  applyCommittedQuoteAcceptance,
  canCancelCustomerJob,
  canReopenCustomerJob,
  executeJobLifecycleAction,
  filterJobsByStatus,
  normalizeJobActivity,
  summarizeJobStatuses,
  validateCancelReason,
  type JobActivityEvent,
  type JobStatusFilter,
  type RelatedBookingRef,
} from '../../lib/job-lifecycle';

type Trade={id:string;name:string;slug:string};
type Area={id:string;area_name:string;city:string};
type NoticeTone='status'|'warning'|'error';

const EMPTY_ACTIVITY:JobActivityDrawerState={open:false,loading:false,error:'',events:[]};

const STATUS_FILTER_OPTIONS:{key:JobStatusFilter;label:string}[]=[
 {key:'all',label:'All'},
 {key:'open',label:'Open'},
 {key:'booked',label:'Booked'},
 {key:'completed',label:'Completed'},
 {key:'cancelled',label:'Cancelled'},
];

export default function Jobs(){
 const [jobs,setJobs]=useState<CustomerJobRecord[]>([]);
 const [quotes,setQuotes]=useState<CustomerQuoteRecord[]>([]);
 const [bookingsByJob,setBookingsByJob]=useState<Record<string,RelatedBookingRef>>({});
 const [trades,setTrades]=useState<Trade[]>([]);
 const [areas,setAreas]=useState<Area[]>([]);

 const [title,setTitle]=useState('');
 const [description,setDescription]=useState('');
 const [trade,setTrade]=useState('');
 const [area,setArea]=useState('');
 const [budget,setBudget]=useState('');
 const [contactPreference,setContactPreference]=useState<ContactPreference>('in_app_messages');
 const [quoteSort,setQuoteSort]=useState<QuoteSortMode>('lowest_price');
 const [statusFilter,setStatusFilter]=useState<JobStatusFilter>('all');

 const [userId,setUserId]=useState('');
 const [message,setMessage]=useState('');
 const [messageTone,setMessageTone]=useState<NoticeTone>('status');
 const [needsManualRefresh,setNeedsManualRefresh]=useState(false);
 const [busy,setBusy]=useState(false);
 const [busyActionLabel,setBusyActionLabel]=useState('');
 const [refreshingList,setRefreshingList]=useState(false);
 const [initialLoading,setInitialLoading]=useState(true);
 const [initialLoadError,setInitialLoadError]=useState('');

 const [confirmQuoteId,setConfirmQuoteId]=useState<string|null>(null);
 const [confirmCancelJobId,setConfirmCancelJobId]=useState<string|null>(null);
 const [cancelReason,setCancelReason]=useState('');
 const [cancelReasonError,setCancelReasonError]=useState<string|null>(null);
 const [confirmReopenJobId,setConfirmReopenJobId]=useState<string|null>(null);
 const [activityByJob,setActivityByJob]=useState<Record<string,JobActivityDrawerState>>({});

 const [site,setSite]=useState<SelectedLocation|null>(null);
 const [checkedSite,setCheckedSite]=useState<SelectedLocation|null>(null);
 const [addressVersion,setAddressVersion]=useState(0);
 const [manualProperty,setManualProperty]=useState('');
 const [territoryRetry,setTerritoryRetry]=useState(0);
 const [territoryFailed,setTerritoryFailed]=useState(false);
 const [territoryVerified,setTerritoryVerified]=useState(false);
 const [territoryChecking,setTerritoryChecking]=useState(false);
 const [territoryNotice,setTerritoryNotice]=useState('');
 const [manualFallbackAllowed,setManualFallbackAllowed]=useState(false);

 const actionInFlight=useRef(false);
 const userIdRef=useRef('');
 const activityRequests=useRef<Map<string,number>>(new Map());

 const publishBlocker=jobPublishBlocker({
  title,description,trade,site,manualProperty,area,budget,busy,
  territoryChecking,checkedSite,territoryVerified,manualFallbackAllowed,
 });
 const step1Done=meaningfulJobTextLength(title)>=5&&meaningfulJobTextLength(description)>=15&&Boolean(trade);
 const step2Done=Boolean(
  site&&checkedSite===site&&!territoryChecking&&(territoryVerified||manualFallbackAllowed)&&area&&
  (site.precision!=='postcode'||manualProperty.trim().length>=5)
 );
 const step3Done=!publishBlocker;

 const statusCounts=useMemo(()=>summarizeJobStatuses(jobs),[jobs]);
 const visibleJobs=useMemo(()=>filterJobsByStatus(jobs,statusFilter),[jobs,statusFilter]);

 function showNotice(text:string,tone:NoticeTone='status',requireRefresh=false){
  setMessage(text);
  setMessageTone(tone);
  setNeedsManualRefresh(requireRefresh);
 }

 const refresh=useCallback(async(activeUserId?:string)=>{
  const s=supabaseBrowser();
  const uid=activeUserId||userIdRef.current;
  const [j,q,b]=await Promise.all([
   s.from('jobs')
    .select('id,title,description,status,created_at,budget_pence,contact_preference,trade_id,area_id')
    .order('created_at',{ascending:false})
    .limit(100),
   s.rpc('customer_quotes'),
   uid
    ? s.from('job_bookings')
       .select('id,job_id,quote_id,status')
       .eq('customer_id',uid)
       .order('created_at',{ascending:false})
       .limit(100)
    : Promise.resolve({data:[],error:null}),
  ]);
  if(j.error)throw j.error;
  if(q.error)throw q.error;
  setJobs((j.data||[]) as CustomerJobRecord[]);
  setQuotes((q.data||[]) as CustomerQuoteRecord[]);
  if(!b.error&&Array.isArray(b.data)){
   const mapped:Record<string,RelatedBookingRef>={};
   for(const row of b.data as RelatedBookingRef[]){
    if(!mapped[row.job_id])mapped[row.job_id]=row;
   }
   setBookingsByJob(mapped);
  }
 },[]);

 async function loadJobActivity(jobId:string){
  const nextSeq=(activityRequests.current.get(jobId)||0)+1;
  activityRequests.current.set(jobId,nextSeq);
  setActivityByJob(prev=>({
   ...prev,
   [jobId]:{
    open:true,
    loading:true,
    error:'',
    events:prev[jobId]?.events||[],
   },
  }));
  try{
   const {data,error}=await supabaseBrowser().rpc('customer_job_activity',{p_job:jobId});
   if(error)throw error;
   if(activityRequests.current.get(jobId)===nextSeq){
    setActivityByJob(prev=>({
     ...prev,
     [jobId]:{
      open:true,
      loading:false,
      error:'',
      events:normalizeJobActivity((data||[]) as JobActivityEvent[]),
     },
    }));
   }
  }catch(e){
   if(activityRequests.current.get(jobId)===nextSeq){
    setActivityByJob(prev=>({
     ...prev,
     [jobId]:{
      open:true,
      loading:false,
      error:e instanceof Error?e.message:'Unable to load job activity',
      events:[],
     },
    }));
   }
  }
 }

 function toggleJobActivity(jobId:string){
  const current=activityByJob[jobId];
  if(current?.open){
   activityRequests.current.set(jobId,(activityRequests.current.get(jobId)||0)+1);
   setActivityByJob(prev=>({
    ...prev,
    [jobId]:{...EMPTY_ACTIVITY,open:false},
   }));
   return;
  }
  void loadJobActivity(jobId);
 }

 const loadInitialWorkspace=useCallback(async()=>{
  setInitialLoading(true);
  setInitialLoadError('');
  try{
   const s=supabaseBrowser();
   const [u,t,a]=await Promise.all([
    s.auth.getUser(),
    s.from('trades').select('id,name,slug').order('name'),
    s.from('service_areas').select('id,area_name,city').order('city'),
   ]);
   if(!u.data.user){
    userIdRef.current='';
    setUserId('');
    showNotice('Sign in to post and manage jobs.','status');
    return;
   }
   userIdRef.current=u.data.user.id;
   setUserId(u.data.user.id);
   if(t.error)throw t.error;
   if(a.error)throw a.error;
   setTrades(t.data||[]);
   setAreas(a.data||[]);
   const params=new URLSearchParams(window.location.search);
   const requestedTrade=params.get('trade')||'';
   const requestedArea=params.get('area')||'';
   const matchedTrade=(t.data||[]).find(item=>item.slug===requestedTrade);
   if(matchedTrade)setTrade(matchedTrade.id);
   if((a.data||[]).some(item=>item.id===requestedArea))setArea(requestedArea);
   await refresh(u.data.user.id);
  }catch(e){
   const errMsg=e instanceof Error?e.message:'Could not load your jobs right now.';
   setInitialLoadError(errMsg);
   showNotice(errMsg,'error');
  }finally{
   setInitialLoading(false);
  }
 },[refresh]);

 useEffect(()=>{
  void loadInitialWorkspace();
 },[loadInitialWorkspace]);

 useEffect(()=>{
  let active=true;
  if(!site){
   setCheckedSite(null);setTerritoryFailed(false);setTerritoryVerified(false);
   setManualFallbackAllowed(false);setTerritoryNotice('');setTerritoryChecking(false);setArea('');
   return;
  }
  setCheckedSite(null);setTerritoryFailed(false);setTerritoryChecking(true);
  setTerritoryVerified(false);setManualFallbackAllowed(false);
  setTerritoryNotice('Checking verified TrustFive territory coverage…');setArea('');
  (async()=>{
   try{
    const {data,error}=await supabaseBrowser().rpc('resolve_trustfive_territory',{
     p_country:site.country,p_lat:site.latitude,p_lon:site.longitude,
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
    if(active){
     setTerritoryFailed(true);setManualFallbackAllowed(false);
     setTerritoryNotice('Territory verification is unavailable. For your protection, job publishing is paused until it can be checked.');
    }
   }finally{
    if(active)setTerritoryChecking(false);
   }
  })();
  return()=>{active=false;};
 },[site,areas,territoryRetry]);

 async function handleManualRefresh(){
  if(refreshingList||busy)return;
  setRefreshingList(true);
  try{
   await refresh();
   setInitialLoadError('');
   showNotice('Job list refreshed with the latest TrustFive records.','status',false);
  }catch(e){
   showNotice(
    e instanceof Error?e.message:'Still unable to refresh your job list. Please try again shortly.',
    'error',
    true
   );
  }finally{
   setRefreshingList(false);
  }
 }

 async function submit(e:FormEvent){
  e.preventDefault();
  if(!userId||busy||actionInFlight.current)return;
  if(publishBlocker){showNotice(publishBlocker,'error');return;}
  actionInFlight.current=true;setBusy(true);setBusyActionLabel('publish');setMessage('');
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
    p_lat:site.latitude,p_lon:site.longitude,p_precision:site.precision,
   });
   if(error)throw error;
   let prefWarning='';
   if(createdJobId&&contactPreference!=='in_app_messages'){
    const prefRes=await s.rpc('set_job_contact_preference',{
     p_job:createdJobId,
     p_preference:contactPreference,
    });
    if(prefRes.error){
     prefWarning=' Contact preference stayed on TrustFive messages.';
    }
   }
   setTitle('');setDescription('');setBudget('');setContactPreference('in_app_messages');
   setSite(null);setCheckedSite(null);setManualProperty('');setTerritoryVerified(false);setAddressVersion(v=>v+1);
   try{
    await refresh();
    showNotice(
     'Job published. Your selected address is stored privately and is not shown in public job descriptions. Only eligible approved professionals covering your service territory can view the brief.'+prefWarning,
     'status'
    );
   }catch{
    showNotice(
     'Job published successfully, but your job list could not be refreshed. Use “Refresh job list” before posting again.'+prefWarning,
     'warning',
     true
    );
   }
  }catch(e){showNotice(e instanceof Error?e.message:'Unable to save','error');}
  finally{actionInFlight.current=false;setBusy(false);setBusyActionLabel('');}
 }

 async function accept(quoteId:string){
  if(busy||actionInFlight.current||confirmQuoteId!==quoteId)return;
  if(!canConfirmJobQuote(quoteId,quotes,jobs)){
   setConfirmQuoteId(null);
   showNotice('This quote can no longer be accepted. Refresh your jobs and try again.','error',true);
   return;
  }
  const targetQuote=quotes.find(q=>q.quote_id===quoteId);
  actionInFlight.current=true;setBusy(true);setBusyActionLabel(`accept:${quoteId}`);setMessage('');
  const result=await executeJobLifecycleAction({
   runRpc:async()=>supabaseBrowser().rpc('accept_job_quote',{p_quote:quoteId}),
   onCommittedLocalUpdate:()=>{
    setConfirmQuoteId(null);
    if(targetQuote){
     setJobs(prev=>applyCommittedQuoteAcceptance(prev,quotes,targetQuote.job_id,quoteId).jobs);
     setQuotes(prev=>applyCommittedQuoteAcceptance(jobs,prev,targetQuote.job_id,quoteId).quotes);
    }
   },
   runRefresh:async()=>{
    await refresh();
   },
   successMessage:'Quote accepted and booking recorded. No payment has been taken. Agree appointment and address-sharing details through your booking and messages.',
   refreshFailedMessage:'Booking recorded successfully, but your job list could not be refreshed. Refresh or open Bookings before attempting another confirmation. No payment has been taken.',
   fallbackErrorMessage:'Unable to accept quote',
  });
  actionInFlight.current=false;setBusy(false);setBusyActionLabel('');
  if(result.outcome==='committed'){
   showNotice(result.message,'status',false);
  }else if(result.outcome==='committed_refresh_failed'){
   showNotice(result.message,'warning',true);
  }else{
   showNotice(result.message,'error',false);
  }
 }

 async function cancelJob(job:CustomerJobRecord){
  if(busy||actionInFlight.current||confirmCancelJobId!==job.id)return;
  const hasBooking=Boolean(bookingsByJob[job.id]);
  if(!canCancelCustomerJob(job,hasBooking)){
   setConfirmCancelJobId(null);
   showNotice('Only unbooked draft or open jobs can be cancelled.','error');
   return;
  }
  const reasonError=validateCancelReason(cancelReason);
  if(reasonError){
   setCancelReasonError(reasonError);
   return;
  }
  setCancelReasonError(null);
  actionInFlight.current=true;setBusy(true);setBusyActionLabel(`cancel:${job.id}`);setMessage('');

  const result=await executeJobLifecycleAction({
   runRpc:async()=>
    supabaseBrowser().rpc('cancel_customer_job',{
     p_job:job.id,
     p_reason:cancelReason.trim()||null,
    }),
   onCommittedLocalUpdate:()=>{
    setConfirmCancelJobId(null);
    setCancelReason('');
    setCancelReasonError(null);
    setJobs(prev=>applyCommittedJobCancellation(prev,quotes,job.id).jobs);
    setQuotes(prev=>applyCommittedJobCancellation(jobs,prev,job.id).quotes);
   },
   runRefresh:async()=>{
    await refresh();
    if(activityByJob[job.id]?.open){
     await loadJobActivity(job.id);
    }
   },
   successMessage:'Job cancelled. Pending quotes on this job are no longer open for acceptance.',
   refreshFailedMessage:'Job cancelled and saved, but refreshing the full job list failed. Your job is shown as Cancelled; use “Refresh job list” to sync the latest activity.',
   fallbackErrorMessage:'Unable to cancel job',
  });

  actionInFlight.current=false;setBusy(false);setBusyActionLabel('');
  if(result.outcome==='committed'){
   showNotice(result.message,'status',false);
  }else if(result.outcome==='committed_refresh_failed'){
   showNotice(result.message,'warning',true);
  }else{
   showNotice(result.message,'error',false);
  }
 }

 async function reopenJob(job:CustomerJobRecord){
  if(busy||actionInFlight.current||confirmReopenJobId!==job.id)return;
  const hasBooking=Boolean(bookingsByJob[job.id]);
  if(!canReopenCustomerJob(job,hasBooking)){
   setConfirmReopenJobId(null);
   showNotice('Only cancelled unbooked jobs with a valid trade and service area can be reopened.','error');
   return;
  }
  actionInFlight.current=true;setBusy(true);setBusyActionLabel(`reopen:${job.id}`);setMessage('');

  const result=await executeJobLifecycleAction({
   runRpc:async()=>supabaseBrowser().rpc('reopen_customer_job',{p_job:job.id}),
   onCommittedLocalUpdate:()=>{
    setConfirmReopenJobId(null);
    setJobs(prev=>applyCommittedJobReopen(prev,job.id));
   },
   runRefresh:async()=>{
    await refresh();
    if(activityByJob[job.id]?.open){
     await loadJobActivity(job.id);
    }
   },
   successMessage:'Job reopened. Eligible local approved professionals can now see the brief again.',
   refreshFailedMessage:'Job reopened and saved, but refreshing the full job list failed. Your job is shown as Open; use “Refresh job list” to sync the latest activity.',
   fallbackErrorMessage:'Unable to reopen job',
  });

  actionInFlight.current=false;setBusy(false);setBusyActionLabel('');
  if(result.outcome==='committed'){
   showNotice(result.message,'status',false);
  }else if(result.outcome==='committed_refresh_failed'){
   showNotice(result.message,'warning',true);
  }else{
   showNotice(result.message,'error',false);
  }
 }

 return <main className="container jobs-page">
  <div className="page-heading">
   <span className="eyebrow">Customer marketplace</span>
   <h1>My jobs and quotes</h1>
   <p className="subtle">Post a job step-by-step, track Open, Booked, Completed and Cancelled requests, inspect genuine chronological activity, and compare quotations from independently approved local professionals.</p>
  </div>

  {message&&(
   <div
    className={messageTone==='error'?'notice error':messageTone==='warning'?'notice notice-warn':'notice'}
    role={messageTone==='error'?'alert':'status'}
    aria-live={messageTone==='error'?'assertive':'polite'}
    data-testid="job-status-banner"
   >
    <p style={{margin:0}}>{message}</p>
    {needsManualRefresh&&(
     <div style={{marginTop:10}}>
      <button type="button" className="btn secondary" disabled={refreshingList||busy} onClick={()=>void handleManualRefresh()}>
       {refreshingList?'Refreshing…':'Refresh job list'}
      </button>
     </div>
    )}
   </div>
  )}

  {initialLoading?(
   <div className="card" role="status" aria-live="polite" aria-busy="true">
    <p style={{margin:0}}>Checking your account and loading your jobs, quotes and bookings…</p>
   </div>
  ):!userId?(
   <Link className="btn" href={'/account?next='+encodeURIComponent(typeof window==='undefined'?'/jobs':window.location.pathname+window.location.search)}>
    Sign in / create account
   </Link>
  ):(
   <div className="two-col jobs-workspace">
    <section className="card jobs-post-panel">
     <h2>Post a job</h2>
     <ol aria-label="Job posting progress" className="jobs-wizard-steps">
      <li className="pill">{step1Done?'✓':'1.'} Trade &amp; scope</li>
      <li className="pill">{step2Done?'✓':'2.'} Location &amp; territory</li>
      <li className="pill">{step3Done?'✓':'3.'} Contact &amp; publish</li>
     </ol>
     <form className="form" onSubmit={submit}>
      <fieldset className="jobs-fieldset">
       <legend>Step 1 · Trade &amp; work scope</legend>
       <div className="form">
        <label>Job title<input required minLength={5} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Fix leaking kitchen tap"/></label>
        <label>What needs doing?<textarea required minLength={15} maxLength={3000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the work, access and materials. Do not include private contact details."/></label>
        <TradeQuickPick trades={trades} value={trade} onChange={setTrade}/>
        <label>Trade<select required value={trade} onChange={e=>setTrade(e.target.value)}><option value="">Choose a service</option>{trades.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label>
       </div>
      </fieldset>

      <fieldset className="jobs-fieldset">
       <legend>Step 2 · Private job-site location</legend>
       <div className="form">
        <AddressSearch key={addressVersion} onSelect={point=>{setCheckedSite(null);setArea('');setTerritoryVerified(false);setManualFallbackAllowed(false);setSite(point);setManualProperty('');}}/>
        {site?.precision==='postcode'&&<label>House number/name and street (private, required)<input required minLength={5} maxLength={100} autoComplete="address-line1" value={manualProperty} onChange={e=>setManualProperty(e.target.value)} placeholder="e.g. 14 High Street" aria-describedby="postcode-location-note"/><span id="postcode-location-note" className="muted-note">We will store this with your postcode as your private job address. The map position remains the approximate postcode centre, not your property&apos;s exact coordinates.</span></label>}
        <label>TrustFive service territory {territoryVerified?'(verified automatically)':'(temporary manual selection)'}<select required disabled={territoryVerified||territoryChecking||!manualFallbackAllowed} value={area} onChange={e=>setArea(e.target.value)}><option value="">Choose an area</option>{areas.map(a=><option value={a.id} key={a.id}>{a.area_name}, {a.city}</option>)}</select></label>
        {site&&territoryNotice&&<div className={territoryFailed?'notice error':'notice'} role="status" aria-live="polite"><p>{territoryNotice}</p>{territoryFailed&&<button type="button" className="btn secondary" disabled={territoryChecking} onClick={()=>setTerritoryRetry(v=>v+1)}>Retry territory verification</button>}</div>}
       </div>
      </fieldset>

      <fieldset className="jobs-fieldset">
       <legend>Step 3 · Budget &amp; contact preference</legend>
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

      <button disabled={Boolean(publishBlocker)} aria-describedby="job-publish-guidance" className="btn" type="submit">{busy&&busyActionLabel==='publish'?'Saving…':'Publish job request'}</button>
      <p id="job-publish-guidance" className="muted-note" aria-live="polite">{publishBlocker||'Your job request is ready to publish.'}</p>
     </form>
     <p style={{marginTop:18}} className="muted-note">Choose your property from the address suggestions. If only a postcode is available, enter your house number/name and street separately. The postcode-centre coordinates remain approximate. Your selected address is stored privately; do not repeat it in your public description.</p>
    </section>

    <section className="jobs-list-panel" aria-labelledby="customer-jobs-heading">
     <div className="jobs-list-header">
      <div>
       <h2 id="customer-jobs-heading" style={{margin:0}}>Your job requests &amp; quotes</h2>
       <p className="muted-note" style={{margin:'4px 0 0'}}>
        {statusCounts.all} total · {statusCounts.open} open · {statusCounts.booked} booked · {statusCounts.completed} completed · {statusCounts.cancelled} cancelled
       </p>
      </div>
      <div className="jobs-list-controls">
       <label className="jobs-sort-label">
        <span>Sort quotes</span>
        <select value={quoteSort} onChange={e=>setQuoteSort(e.target.value as QuoteSortMode)}>
         <option value="lowest_price">Lowest price first</option>
         <option value="newest">Newest first</option>
        </select>
       </label>
       <button type="button" className="btn secondary jobs-refresh-btn" disabled={refreshingList||busy} onClick={()=>void handleManualRefresh()}>
        {refreshingList?'Refreshing…':'Refresh'}
       </button>
      </div>
     </div>

     <div className="job-filter-bar" role="group" aria-label="Filter jobs by status">
      {STATUS_FILTER_OPTIONS.map(opt=>{
       const count=statusCounts[opt.key];
       const active=statusFilter===opt.key;
       return <button
        key={opt.key}
        type="button"
        className={`job-filter-btn${active?' active':''}`}
        aria-pressed={active}
        data-testid={`job-filter-${opt.key}`}
        onClick={()=>setStatusFilter(opt.key)}
       >
        <span>{opt.label}</span>
        <span className="job-filter-count">{count}</span>
       </button>;
      })}
     </div>

     <div className="list">
      {initialLoadError&&jobs.length===0?(
       <div className="card" role="alert">
        <h3 style={{marginTop:0}}>Unable to load your jobs</h3>
        <p className="muted-note" style={{marginBottom:14}}>{initialLoadError}</p>
        <button type="button" className="btn" onClick={()=>void loadInitialWorkspace()}>Retry loading jobs</button>
       </div>
      ):jobs.length===0?(
       <div className="card">
        <h3 style={{marginTop:0}}>You haven&apos;t posted any jobs yet</h3>
        <p className="muted-note">Use the 3-step form on this page to post your first request to independently approved local professionals.</p>
       </div>
      ):visibleJobs.length===0?(
       <div className="card">
        <h3 style={{marginTop:0}}>No {statusFilter} jobs</h3>
        <p className="muted-note" style={{marginBottom:12}}>You have {statusCounts.all} job{statusCounts.all===1?'':'s'} in other statuses.</p>
        <button type="button" className="btn secondary" onClick={()=>setStatusFilter('all')}>Show all jobs</button>
       </div>
      ):(
       visibleJobs.map(j=>{
        const jobQuotes=sortCustomerQuotes(quotes.filter(q=>q.job_id===j.id),quoteSort);
        const booking=bookingsByJob[j.id]||null;
        return <CustomerJobCard
         key={j.id}
         job={j}
         quotes={jobQuotes}
         booking={booking}
         busy={busy}
         busyActionLabel={busyActionLabel}
         confirmCancelOpen={confirmCancelJobId===j.id}
         cancelReason={cancelReason}
         cancelReasonError={confirmCancelJobId===j.id?cancelReasonError:null}
         confirmReopenOpen={confirmReopenJobId===j.id}
         confirmQuoteId={confirmQuoteId}
         activity={activityByJob[j.id]||EMPTY_ACTIVITY}
         onToggleActivity={toggleJobActivity}
         onRetryActivity={id=>void loadJobActivity(id)}
         onStartCancel={id=>{
          setConfirmCancelJobId(id);
          setConfirmReopenJobId(null);
          setConfirmQuoteId(null);
          setCancelReason('');
          setCancelReasonError(null);
          setMessage('');
         }}
         onAbortCancel={()=>{
          setConfirmCancelJobId(null);
          setCancelReason('');
          setCancelReasonError(null);
         }}
         onCancelReasonChange={value=>{
          setCancelReason(value);
          setCancelReasonError(validateCancelReason(value));
         }}
         onConfirmCancel={target=>void cancelJob(target)}
         onStartReopen={id=>{
          setConfirmReopenJobId(id);
          setConfirmCancelJobId(null);
          setConfirmQuoteId(null);
          setCancelReason('');
          setCancelReasonError(null);
          setMessage('');
         }}
         onAbortReopen={()=>setConfirmReopenJobId(null)}
         onConfirmReopen={target=>void reopenJob(target)}
         onStartAcceptQuote={qId=>{
          setConfirmQuoteId(qId);
          setConfirmCancelJobId(null);
          setConfirmReopenJobId(null);
          setMessage('');
         }}
         onAbortAcceptQuote={()=>setConfirmQuoteId(null)}
         onConfirmAcceptQuote={qId=>void accept(qId)}
        />;
       })
      )}
     </div>
    </section>
   </div>
  )}
 </main>;
}
