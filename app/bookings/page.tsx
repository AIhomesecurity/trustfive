'use client';
import {FormEvent,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import {loadBookingSiteBatch} from '../../lib/booking-site-batch';
import {
  authorisedBookingSelection,
  bookingScheduleHref,
  quoteMessagesHref,
} from '../../lib/workflow-links';
import {canConfirmCompletedBooking} from '../../lib/booking-completion-guard';
import {deriveBookingProgressSteps} from '../../lib/quote-comparison';
import {formatAppointmentWindow} from '../../lib/appointment-schedule';
import {
  applyCommittedBookingStatus,
  applyCommittedReview,
  clearBookingSiteCache,
  executeBookingAction,
  filterBookings,
  getBookingStatusMeta,
  markBookingSiteNeedsRecheck,
  resolveCustomerSiteConsentView,
  summarizeBookingStatuses,
  validateBookingReviewInput,
  type BookingStatusFilter,
} from '../../lib/booking-lifecycle';

type Booking={id:string;quote_id:string;job_id:string;customer_id:string;professional_id:string;status:string;created_at:string};
type Appointment={booking_id:string;status:string;starts_at:string;ends_at:string;timezone_name:string};
type Review={booking_id:string};
type JobSite={address_label:string;postcode:string|null;sharing_enabled:boolean};
type NoticeTone='status'|'warning'|'error';

const BOOKING_FILTER_OPTIONS:{key:BookingStatusFilter;label:string}[]=[
 {key:'all',label:'All'},
 {key:'active',label:'Active'},
 {key:'needs_action',label:'Needs action'},
 {key:'completed',label:'Completed'},
];

export default function Bookings(){
 const [userId,setUserId]=useState('');
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [reviews,setReviews]=useState<Review[]>([]);
 const [appointments,setAppointments]=useState<Record<string,Appointment>>({});
 const [statusFilter,setStatusFilter]=useState<BookingStatusFilter>('all');
 const [sites,setSites]=useState<Record<string,JobSite|null>>({});
 const [siteBusy,setSiteBusy]=useState('');
 const [siteUnavailableIds,setSiteUnavailableIds]=useState<string[]>([]);

 const [checkingAccount,setCheckingAccount]=useState(true);
 const [loadingBookings,setLoadingBookings]=useState(false);
 const [initialLoadError,setInitialLoadError]=useState('');
 const [focusBooking,setFocusBooking]=useState('');
 const [unavailableBooking,setUnavailableBooking]=useState(false);

 const [selected,setSelected]=useState<Booking|null>(null);
 const [stars,setStars]=useState('5');
 const [body,setBody]=useState('');
 const [reviewError,setReviewError]=useState<string|null>(null);

 const [notice,setNotice]=useState('');
 const [noticeTone,setNoticeTone]=useState<NoticeTone>('status');
 const [needsManualRefresh,setNeedsManualRefresh]=useState(false);

 const [busy,setBusy]=useState(false);
 const [busyActionKey,setBusyActionKey]=useState('');
 const [completionConfirmationId,setCompletionConfirmationId]=useState<string|null>(null);
 const [readyConfirmationId,setReadyConfirmationId]=useState<string|null>(null);
 const [shareConfirmBookingId,setShareConfirmBookingId]=useState<string|null>(null);

 const refreshRequest=useRef(0);
 const actionInFlight=useRef(false);
 const userIdRef=useRef('');

 function showNotice(text:string,tone:NoticeTone='status',requireRefresh=false){
  setNotice(text);
  setNoticeTone(tone);
  setNeedsManualRefresh(requireRefresh);
 }

 const refresh=useCallback(async(explicitUser?:string)=>{
  const user=explicitUser||userIdRef.current;
  if(!user)return;
  const currentRequest=++refreshRequest.current;
  // Never retain previously retrieved private job-site addresses while
  // booking ownership and consent are being rechecked.
  setSites({});
  setSiteUnavailableIds([]);
  setLoadingBookings(true);
  try{
   const s=supabaseBrowser();
   const [b,r,ap]=await Promise.all([
    s.from('job_bookings')
     .select('id,quote_id,job_id,customer_id,professional_id,status,created_at')
     .or('customer_id.eq.'+user+',professional_id.eq.'+user)
     .order('created_at',{ascending:false})
     .limit(75),
    s.from('booking_reviews').select('booking_id').eq('author_id',user),
    s.from('booking_appointments').select('booking_id,status,starts_at,ends_at,timezone_name'),
   ]);
   if(b.error)throw b.error;
   if(r.error)throw r.error;
   if(currentRequest!==refreshRequest.current)return;
   const records=(b.data||[]) as Booking[];
   setBookings(records);
   setReviews((r.data||[]) as Review[]);
   const apptMap:Record<string,Appointment>={};
   if(!ap.error&&ap.data){
    for(const item of ap.data as Appointment[])apptMap[item.booking_id]=item;
   }
   setAppointments(apptMap);
   const requested=new URLSearchParams(window.location.search).get('booking');
   setFocusBooking(authorisedBookingSelection(requested,records.map(item=>item.id)));
   setUnavailableBooking(Boolean(requested&&!records.some(item=>item.id===requested)));
   // Each RPC is individually authorised in the database. A denied or timed-out
   // lookup must not make unrelated bookings disappear from the customer UI.
   const {sites:loadedSites,unavailableIds}=await loadBookingSiteBatch<JobSite>(
    records.map(booking=>booking.id),
    async bookingId=>{
     const {data,error}=await s.rpc('booking_job_site_address',{p_booking:bookingId});
     if(error)throw error;
     return (data?.[0]||null) as JobSite|null;
    }
   );
   if(currentRequest!==refreshRequest.current)return;
   setSites(loadedSites);
   setSiteUnavailableIds(unavailableIds);
  }finally{
   if(currentRequest===refreshRequest.current)setLoadingBookings(false);
  }
 },[]);

 const loadInitialBookings=useCallback(async()=>{
  setCheckingAccount(true);
  setInitialLoadError('');
  try{
   const {data:{user},error}=await supabaseBrowser().auth.getUser();
   if(error)throw error;
   if(!user){
    userIdRef.current='';
    setUserId('');
    showNotice('Sign in to manage your bookings.','status');
    return;
   }
   userIdRef.current=user.id;
   setUserId(user.id);
   await refresh(user.id);
  }catch(e){
   const msg=e instanceof Error?e.message:'Unable to load bookings right now.';
   setInitialLoadError(msg);
   showNotice(msg,'error');
  }finally{
   setCheckingAccount(false);
  }
 },[refresh]);

 useEffect(()=>{
  void loadInitialBookings();
 },[loadInitialBookings]);

 async function handleManualRefresh(){
  if(loadingBookings||busy||!userIdRef.current)return;
  try{
   await refresh(userIdRef.current);
   setInitialLoadError('');
   showNotice('Bookings refreshed with the latest TrustFive records.','status',false);
  }catch(e){
   showNotice(
    e instanceof Error?e.message:'Could not refresh bookings right now. Please try again shortly.',
    'error',
    true
   );
  }
 }

 async function act(action:'mark_job_ready_for_confirmation'|'confirm_job_completed',id:string){
  if(busy||loadingBookings||actionInFlight.current)return;
  if(action==='confirm_job_completed'&&!canConfirmCompletedBooking(
   completionConfirmationId,bookings.find(b=>b.id===id),userId
  )){
   setCompletionConfirmationId(null);
   showNotice('This booking is not ready for your completion confirmation. Refresh your bookings and try again.','error',true);
   return;
  }
  if(action==='mark_job_ready_for_confirmation'&&readyConfirmationId!==id){
   return;
  }
  actionInFlight.current=true;
  setBusy(true);
  setBusyActionKey(`${action}:${id}`);
  setNotice('');

  const nextStatus=action==='confirm_job_completed'?'completed':'awaiting_customer';
  const result=await executeBookingAction({
   runRpc:async()=>supabaseBrowser().rpc(action,{p_booking:id}),
   onCommittedLocalUpdate:()=>{
    setCompletionConfirmationId(null);
    setReadyConfirmationId(null);
    setBookings(prev=>applyCommittedBookingStatus(prev,id,nextStatus));
   },
   runRefresh:async()=>{
    await refresh(userIdRef.current);
   },
   successMessage:action==='confirm_job_completed'
    ?'You confirmed the work as completed. You can now leave a genuine review based on your experience.'
    :'Work marked ready for customer confirmation. The customer must independently confirm completion.',
   refreshFailedMessage:action==='confirm_job_completed'
    ?'Completion confirmed and saved, but refreshing the full booking list failed. Your booking is shown as Completed; use “Refresh bookings” to sync.'
    :'Work marked ready and saved, but refreshing the full booking list failed. Use “Refresh bookings” to sync the latest details.',
   fallbackErrorMessage:'Unable to update booking',
  });

  actionInFlight.current=false;
  setBusy(false);
  setBusyActionKey('');
  if(result.outcome==='committed'){
   showNotice(result.message,'status',false);
  }else if(result.outcome==='committed_refresh_failed'){
   showNotice(result.message,'warning',true);
  }else{
   showNotice(result.message,'error',false);
  }
 }

 async function shareAddress(booking:Booking,enabled:boolean){
  if(busy||siteBusy||actionInFlight.current)return;
  actionInFlight.current=true;
  setSiteBusy(booking.id);
  setNotice('');
  // Remove the target booking's cached address immediately so a failed change
  // never leaves stale private address consent displayed as current, while
  // marking it for live recheck so recovery controls never vanish.
  setSites(prev=>clearBookingSiteCache(prev,booking.id));
  setSiteUnavailableIds(prev=>markBookingSiteNeedsRecheck(prev,booking.id));

  const result=await executeBookingAction({
   runRpc:async()=>supabaseBrowser().rpc('set_booking_address_sharing',{p_booking:booking.id,p_allow:enabled}),
   onCommittedLocalUpdate:()=>{
    setShareConfirmBookingId(null);
   },
   runRefresh:async()=>{
    await refresh(userIdRef.current);
   },
   successMessage:enabled
    ?'Your selected address is now available to this booked professional.'
    :'Exact address sharing has been turned off for this booking.',
   refreshFailedMessage:enabled
    ?'Address sharing was enabled and saved, but refreshing the display failed. Use “Recheck address status” or “Refresh bookings” to verify.'
    :'Address sharing was turned off and saved, but refreshing the display failed. Use “Recheck address status” or “Refresh bookings” to verify.',
   fallbackErrorMessage:'Unable to update address sharing',
  });

  actionInFlight.current=false;
  setSiteBusy('');
  if(result.outcome==='committed'){
   showNotice(result.message,'status',false);
  }else if(result.outcome==='committed_refresh_failed'){
   showNotice(result.message,'warning',true);
  }else{
   setShareConfirmBookingId(null);
   showNotice(result.message,'error',true);
  }
 }

 async function review(e:FormEvent){
  e.preventDefault();
  if(!selected||busy||actionInFlight.current)return;
  const validationError=validateBookingReviewInput(stars,body);
  if(validationError){
   setReviewError(validationError);
   return;
  }
  setReviewError(null);
  const targetBooking=selected;
  actionInFlight.current=true;
  setBusy(true);
  setBusyActionKey(`review:${targetBooking.id}`);
  setNotice('');

  const result=await executeBookingAction({
   runRpc:async()=>{
    const rating=Number(stars);
    return supabaseBrowser().from('booking_reviews').insert({
     booking_id:targetBooking.id,
     author_id:userIdRef.current,
     professional_id:targetBooking.professional_id,
     stars:rating,
     body:body.trim(),
    });
   },
   onCommittedLocalUpdate:()=>{
    setReviews(prev=>applyCommittedReview(prev,targetBooking.id));
    setSelected(null);
    setBody('');
    setStars('5');
    setReviewError(null);
   },
   runRefresh:async()=>{
    await refresh(userIdRef.current);
   },
   successMessage:'Review submitted for a confirmed completed booking.',
   refreshFailedMessage:'Review submitted and saved, but refreshing your booking list failed. Use “Refresh bookings” to sync.',
   fallbackErrorMessage:'Unable to submit review',
  });

  actionInFlight.current=false;
  setBusy(false);
  setBusyActionKey('');
  if(result.outcome==='committed'){
   showNotice(result.message,'status',false);
  }else if(result.outcome==='committed_refresh_failed'){
   showNotice(result.message,'warning',true);
  }else{
   showNotice(result.message,'error',false);
  }
 }

 const filterCounts=useMemo(()=>summarizeBookingStatuses(bookings,userId),[bookings,userId]);
 const visibleBookings=useMemo(()=>filterBookings(bookings,statusFilter,userId),[bookings,statusFilter,userId]);

 return <main className="container bookings-page">
  <div className="page-heading">
   <span className="eyebrow">Bookings and quality</span>
   <h1>My bookings</h1>
   <div className="bookings-header-actions">
    <Link className="btn secondary" href="/schedule">Manage appointment times</Link>
    <Link className="btn secondary" href="/jobs">My jobs &amp; quotes</Link>
   </div>
   <p className="subtle">Track every stage from accepted quote and agreed appointment to completion confirmation. Reviews are linked exclusively to confirmed completed bookings.</p>
  </div>

  {notice&&(
   <div
    className={noticeTone==='error'?'notice error':noticeTone==='warning'?'notice notice-warn':'notice'}
    role={noticeTone==='error'?'alert':'status'}
    aria-live={noticeTone==='error'?'assertive':'polite'}
    data-testid="booking-status-banner"
   >
    <p style={{margin:0}}>{notice}</p>
    {needsManualRefresh&&(
     <div style={{marginTop:10}}>
      <button type="button" className="btn secondary" disabled={loadingBookings||busy} onClick={()=>void handleManualRefresh()}>
       {loadingBookings?'Refreshing…':'Refresh bookings'}
      </button>
     </div>
    )}
   </div>
  )}

  {checkingAccount?(
   <div className="card" role="status" aria-live="polite" aria-busy="true">
    <p style={{margin:0}}>Checking your account and loading bookings…</p>
   </div>
  ):!userId?(
   <Link className="btn" href="/account?next=%2Fbookings">Sign in to see your bookings</Link>
  ):(
   <>
    <div className="booking-overview">
     <div className="card"><strong>{filterCounts.all}</strong><span>Recent bookings</span></div>
     <div className="card"><strong>{filterCounts.active}</strong><span>Active bookings</span></div>
     <div className="card"><strong>{bookings.filter(b=>b.status==='awaiting_customer'&&b.customer_id===userId).length}</strong><span>Awaiting your confirmation</span></div>
    </div>

    <div className="bookings-toolbar">
     <div className="job-filter-bar" role="group" aria-label="Filter bookings by status">
      {BOOKING_FILTER_OPTIONS.map(opt=>{
       const active=statusFilter===opt.key;
       const count=filterCounts[opt.key];
       return <button
        key={opt.key}
        type="button"
        className={`job-filter-btn${active?' active':''}`}
        aria-pressed={active}
        data-testid={`booking-filter-${opt.key}`}
        onClick={()=>setStatusFilter(opt.key)}
       >
        <span>{opt.label}</span>
        <span className="job-filter-count">{count}</span>
       </button>;
      })}
     </div>
     <button type="button" className="btn secondary jobs-refresh-btn" disabled={loadingBookings||busy} onClick={()=>void handleManualRefresh()}>
      {loadingBookings?'Refreshing…':'Refresh'}
     </button>
    </div>

    {unavailableBooking&&<p role="alert" className="notice error">That booking is not accessible to this account. Only your own bookings are listed below.</p>}
    {focusBooking&&<p role="status" className="notice">Showing your selected booking below. You can also review all your other bookings.</p>}
    {siteUnavailableIds.length>0&&(
     <div className="notice notice-warn" role="status">
      <p style={{margin:'0 0 10px'}}>Booking history is available, but private address sharing could not be checked for {siteUnavailableIds.length} booking{siteUnavailableIds.length===1?'':'s'}. No address will be displayed until its access check succeeds.</p>
      <button type="button" className="btn secondary" disabled={loadingBookings} onClick={()=>void handleManualRefresh()}>Retry address checks</button>
     </div>
    )}

    <div className="two-col bookings-workspace">
     <section className="bookings-list-col" aria-labelledby="booking-history-heading">
      <h2 id="booking-history-heading">Booking history</h2>
      <div className="list">
       {initialLoadError&&bookings.length===0?(
        <div className="card" role="alert">
         <h3 style={{marginTop:0}}>Unable to load your bookings</h3>
         <p className="muted-note" style={{marginBottom:14}}>{initialLoadError}</p>
         <button type="button" className="btn" onClick={()=>void loadInitialBookings()}>Retry loading bookings</button>
        </div>
       ):visibleBookings.length===0?(
        <div className="card">
         {bookings.length===0?(
          <>
           <h3 style={{marginTop:0}}>No confirmed bookings yet</h3>
           <p className="muted-note" style={{marginBottom:12}}>Accept a quote on an open job to record a booking and arrange an appointment.</p>
           <Link className="btn" href="/jobs">Go to My jobs</Link>
          </>
         ):(
          <>
           <h3 style={{marginTop:0}}>No bookings match this filter</h3>
           <p className="muted-note" style={{marginBottom:12}}>You have {filterCounts.all} booking{filterCounts.all===1?'':'s'} in other stages.</p>
           <button type="button" className="btn secondary" onClick={()=>setStatusFilter('all')}>Show all bookings</button>
          </>
         )}
        </div>
       ):(
        visibleBookings.map(b=>{
         const appt=appointments[b.id];
         const timeline=deriveBookingProgressSteps(b.status,appt?.status);
         const statusMeta=getBookingStatusMeta(b.status);
         const hasReviewed=reviews.some(r=>r.booking_id===b.id);
         const isCustomer=b.customer_id===userId;
         const isProfessional=b.professional_id===userId;
         const siteInfo=sites[b.id];

         return <article
          className="card booking-card"
          id={'booking-'+b.id}
          key={b.id}
          data-testid={`booking-card-${b.id}`}
          data-booking-status={b.status}
          style={focusBooking===b.id?{borderColor:'#087c46',boxShadow:'0 0 0 2px #d2ebdb'}:undefined}
         >
          <div className="job-card-head">
           <span
            className={`booking-status-pill is-${statusMeta.tone}`}
            data-testid={`booking-status-${b.id}`}
            aria-label={`Booking status: ${statusMeta.badgeLabel}`}
           >
            <span className="job-status-dot" aria-hidden="true"/>
            {statusMeta.badgeLabel}
           </span>
           <span className="muted-note">
            Booking #{b.id.slice(0,8)} · {isCustomer?'Customer':'Professional'}
           </span>
          </div>

          <p className="muted-note" style={{marginTop:8}}>
           Created {new Date(b.created_at).toLocaleDateString('en-GB')} · {statusMeta.description}
          </p>

          <ol className="booking-stepper" aria-label={`Progress for booking ${b.id.slice(0,8)}`}>
           {timeline.map((step,idx)=>(
            <li key={step.label} className={`booking-step is-${step.state}`}>
             <span className="booking-step-num" aria-hidden="true">
              {step.state==='done'?'✓':idx+1}
             </span>
             <span>{step.label}</span>
            </li>
           ))}
          </ol>

          {appt&&(
           <p className="booking-appointment-note">
            <strong>Appointment ({appt.status}):</strong>{' '}
            {formatAppointmentWindow(appt.starts_at,appt.ends_at,appt.timezone_name)}
           </p>
          )}

          <nav className="job-related-links" aria-label={`Links for booking ${b.id.slice(0,8)}`}>
           <Link className="job-related-link" href={quoteMessagesHref(b.quote_id)}>Open quote conversation →</Link>
           <Link className="job-related-link" href={bookingScheduleHref(b.id)}>Manage appointment →</Link>
           <Link className="job-related-link" href="/jobs">View job requests →</Link>
          </nav>

          {isCustomer&&(()=>{
           const consentView=resolveCustomerSiteConsentView({
            bookingStatus:b.status,
            hasLoadedSite:Boolean(siteInfo),
            siteUnavailable:siteUnavailableIds.includes(b.id),
            siteBusy:siteBusy===b.id,
            loadingBookings,
           });
           if(consentView==='none')return null;
           return <div className="notice booking-site-box" data-testid={`customer-site-box-${b.id}`}>
            <h3 style={{marginTop:0,fontSize:16}}>Private job-site address</h3>
            {consentView==='updating'?(
             <p className="muted-note" role="status">Updating private address sharing consent…</p>
            ):consentView==='checking'?(
             <p className="muted-note" role="status">Checking your private address sharing status…</p>
            ):consentView==='unavailable'?(
             <div>
              <p className="muted-note" style={{marginBottom:10}}>
               Private address sharing status could not be confirmed. No cached address is displayed until a live check succeeds.
              </p>
              <button
               type="button"
               className="btn secondary"
               disabled={Boolean(loadingBookings||busy||siteBusy)}
               onClick={()=>void handleManualRefresh()}
              >
               {loadingBookings?'Rechecking…':'Recheck address status'}
              </button>
             </div>
            ):siteInfo?(
             <>
              <p style={{overflowWrap:'anywhere'}}>{siteInfo.address_label}</p>
              <p className="muted-note" style={{marginTop:4}}>
               Only you can share your full address with the professional who has this booking. It is never shown in public leads.
              </p>
              {(b.status==='booked'||b.status==='awaiting_customer')&&(
               <div style={{marginTop:10}}>
                {siteInfo.sharing_enabled?(
                 <>
                  <p className="muted-note" style={{marginBottom:8}}><strong>Sharing enabled.</strong> Turn this off at any time to revoke further access in TrustFive.</p>
                  <button
                   type="button"
                   className="btn secondary"
                   disabled={Boolean(siteBusy||busy)}
                   onClick={()=>void shareAddress(b,false)}
                  >
                   {siteBusy===b.id?'Updating…':'Turn off exact address sharing'}
                  </button>
                 </>
                ):shareConfirmBookingId===b.id?(
                 <div
                  className="job-confirm-panel"
                  role="group"
                  aria-label={`Confirm sharing private address for booking ${b.id.slice(0,8)}`}
                  onKeyDown={e=>{if(e.key==='Escape'&&!siteBusy)setShareConfirmBookingId(null);}}
                 >
                  <h4>Share your exact address with this booked professional?</h4>
                  <p className="muted-note">Only the approved professional assigned to this confirmed booking will be able to view it, and you can turn sharing off afterwards.</p>
                  <div className="job-confirm-actions">
                   <button type="button" className="btn" disabled={Boolean(siteBusy||busy)} onClick={()=>void shareAddress(b,true)}>
                    {siteBusy===b.id?'Sharing…':'Confirm share address'}
                   </button>
                   <button type="button" className="btn secondary" disabled={Boolean(siteBusy)} onClick={()=>setShareConfirmBookingId(null)}>
                    Keep private
                   </button>
                  </div>
                 </div>
                ):(
                 <button
                  type="button"
                  className="btn secondary"
                  disabled={Boolean(siteBusy||busy)}
                  onClick={()=>{setShareConfirmBookingId(b.id);setNotice('');}}
                 >
                  Share exact address with booked professional
                 </button>
                )}
               </div>
              )}
             </>
            ):null}
           </div>;
          })()}

          {isProfessional&&(b.status==='booked'||b.status==='awaiting_customer')&&(
           <div className="notice booking-site-box">
            <h3 style={{marginTop:0,fontSize:16}}>Job-site address</h3>
            {loadingBookings?(
             <p className="muted-note" role="status">Checking customer address consent…</p>
            ):siteUnavailableIds.includes(b.id)?(
             <p className="muted-note">Address access check is temporarily unavailable. Please retry; no address is displayed without confirmation.</p>
            ):siteInfo?(
             <p style={{overflowWrap:'anywhere'}}>{siteInfo.address_label}</p>
            ):(
             <p className="muted-note">The customer has not shared the exact address. Request their permission through messages.</p>
            )}
           </div>
          )}

          {isProfessional&&b.status==='booked'&&(
           readyConfirmationId===b.id?(
            <div
             className="booking-completion-check"
             role="group"
             aria-label={`Confirm marking work ready for booking ${b.id.slice(0,8)}`}
             onKeyDown={e=>{if(e.key==='Escape'&&!busy)setReadyConfirmationId(null);}}
            >
             <h4>Mark work ready for customer confirmation?</h4>
             <p className="muted-note">Only mark work ready once the agreed job is finished. The customer must independently confirm completion before a review can be submitted.</p>
             <div className="booking-completion-actions">
              <button type="button" className="btn" disabled={busy||loadingBookings} onClick={()=>void act('mark_job_ready_for_confirmation',b.id)}>
               {busy&&busyActionKey===`mark_job_ready_for_confirmation:${b.id}`?'Saving…':'Confirm work ready'}
              </button>
              <button type="button" className="btn secondary" disabled={busy} onClick={()=>setReadyConfirmationId(null)}>Not yet</button>
             </div>
            </div>
           ):(
            <div className="job-actions-bar">
             <button type="button" className="btn" disabled={busy||loadingBookings} onClick={()=>{setReadyConfirmationId(b.id);setNotice('');}}>
              Mark work ready
             </button>
            </div>
           )
          )}

          {isCustomer&&b.status==='awaiting_customer'&&(
           completionConfirmationId===b.id?(
            <div
             className="booking-completion-check"
             role="group"
             aria-label={'Confirm completed booking '+b.id.slice(0,8)}
             data-testid={`confirm-completion-panel-${b.id}`}
             onKeyDown={e=>{if(e.key==='Escape'&&!busy)setCompletionConfirmationId(null);}}
            >
             <h4>Has the agreed work actually been completed?</h4>
             <p>Only confirm if you are satisfied that this job is finished. This records your completion confirmation and then permits your genuine completed-booking review. It does not charge a payment or resolve disputes.</p>
             <p className="muted-note">If something is outstanding, message the professional or contact TrustFive support instead.</p>
             <div className="booking-completion-actions">
              <button type="button" className="btn" disabled={busy||loadingBookings} onClick={()=>void act('confirm_job_completed',b.id)}>
               {busy&&busyActionKey===`confirm_job_completed:${b.id}`?'Confirming…':'Yes, work is completed'}
              </button>
              <button type="button" className="btn secondary" disabled={busy} onClick={()=>setCompletionConfirmationId(null)}>Not yet — go back</button>
              <Link className="btn secondary" href={quoteMessagesHref(b.quote_id)}>Message professional</Link>
             </div>
            </div>
           ):(
            <div className="job-actions-bar">
             <button type="button" className="btn" disabled={busy||loadingBookings} onClick={()=>{setCompletionConfirmationId(b.id);setNotice('');}}>
              Review job completion
             </button>
            </div>
           )
          )}

          {isCustomer&&b.status==='completed'&&!hasReviewed&&(
           <div className="job-actions-bar">
            <button
             type="button"
             className="btn secondary"
             disabled={busy}
             onClick={()=>{setSelected(b);setReviewError(null);setNotice('');}}
            >
             Leave verified-booking review
            </button>
           </div>
          )}

          {hasReviewed&&(
           <p className="muted-note" style={{marginTop:10}} data-testid={`review-submitted-${b.id}`}>
            ✓ Verified-booking review submitted
           </p>
          )}
         </article>;
        })
       )}
      </div>
     </section>

     <section className="bookings-side-col">
      {selected&&(
       <div
        className="card"
        style={{marginBottom:18}}
        role="region"
        aria-label={`Review completed booking ${selected.id.slice(0,8)}`}
        data-testid="booking-review-form"
        onKeyDown={e=>{if(e.key==='Escape'&&!busy){setSelected(null);setReviewError(null);}}}
       >
        <h2 style={{marginTop:0}}>Review completed booking #{selected.id.slice(0,8)}</h2>
        <p className="subtle">Your review must describe your actual experience. It will be public and linked to this confirmed booking.</p>
        <form className="form" onSubmit={review}>
         <label>Overall rating
          <select value={stars} disabled={busy} onChange={e=>setStars(e.target.value)}>
           {[5,4,3,2,1].map(n=><option key={n} value={n}>{n} star{n!==1?'s':''}</option>)}
          </select>
         </label>
         <label>Your experience ({body.trim().length}/1500 characters)
          <textarea
           required
           minLength={10}
           maxLength={1500}
           disabled={busy}
           value={body}
           onChange={e=>{setBody(e.target.value);if(reviewError)setReviewError(validateBookingReviewInput(stars,e.target.value));}}
           placeholder="Describe punctuality, workmanship, tidiness and communication."
          />
         </label>
         {reviewError&&<p className="notice error" role="alert" style={{margin:0}}>{reviewError}</p>}
         <div className="job-confirm-actions">
          <button className="btn" disabled={busy} type="submit">
           {busy&&busyActionKey===`review:${selected.id}`?'Submitting…':'Submit review'}
          </button>
          <button className="btn secondary" disabled={busy} type="button" onClick={()=>{setSelected(null);setReviewError(null);}}>
           Cancel
          </button>
         </div>
        </form>
       </div>
      )}
      <div className="card">
       <h3>Fair reviews</h3>
       <p>Only the customer on a completed TrustFive booking can create a booking review. Payment disputes and allegations of misconduct must be investigated independently.</p>
      </div>
     </section>
    </div>
   </>
  )}
 </main>;
}
