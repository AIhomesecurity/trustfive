'use client';
import {FormEvent,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import {authorisedBookingSelection,bookingHistoryHref} from '../../lib/workflow-links';
import {
  formatAppointmentWindow,
  summarizeAppointments,
  validateAppointmentProposal,
  type ScheduledAppointment,
} from '../../lib/appointment-schedule';
import {
  applyCommittedAppointmentStatus,
  executeBookingAction,
  getBookingStatusMeta,
} from '../../lib/booking-lifecycle';

type Booking={id:string;customer_id:string;professional_id:string;status:string};
type NoticeTone='status'|'warning'|'error';

export default function BookingSchedule(){
 const [userId,setUserId]=useState('');
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [appointments,setAppointments]=useState<ScheduledAppointment[]>([]);
 const [selected,setSelected]=useState('');
 const [start,setStart]=useState('');
 const [end,setEnd]=useState('');
 const [zone,setZone]=useState('Europe/London');

 const [notice,setNotice]=useState('');
 const [noticeTone,setNoticeTone]=useState<NoticeTone>('status');
 const [needsManualRefresh,setNeedsManualRefresh]=useState(false);
 const [loadError,setLoadError]=useState('');
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [busy,setBusy]=useState(false);
 const [busyActionKey,setBusyActionKey]=useState('');
 const [confirmAcceptId,setConfirmAcceptId]=useState<string|null>(null);
 const [confirmCancelId,setConfirmCancelId]=useState<string|null>(null);
 const [unavailableBooking,setUnavailableBooking]=useState(false);
 const inFlight=useRef(false);

 function showNotice(text:string,tone:NoticeTone='status',requireRefresh=false){
  setNotice(text);
  setNoticeTone(tone);
  setNeedsManualRefresh(requireRefresh);
 }

 async function refresh(){
  setLoadError('');
  const s=supabaseBrowser();
  const b=await s.from('job_bookings')
   .select('id,customer_id,professional_id,status')
   .order('created_at',{ascending:false})
   .limit(75);
  if(b.error)throw b.error;
  const current=(b.data||[]) as Booking[];
  setBookings(current);
  const bookingIds=current.map(item=>item.id);
  if(bookingIds.length){
   const a=await s.from('booking_appointments')
    .select('booking_id,proposed_by,starts_at,ends_at,timezone_name,status')
    .in('booking_id',bookingIds);
   if(a.error)throw a.error;
   setAppointments((a.data||[]) as ScheduledAppointment[]);
  }else{
   setAppointments([]);
  }
  const requested=new URLSearchParams(window.location.search).get('booking');
  if(requested){
   const eligible=current.filter(item=>item.status==='booked'||item.status==='awaiting_customer').map(item=>item.id);
   const allowed=authorisedBookingSelection(requested,eligible);
   setUnavailableBooking(!allowed);
   setSelected(allowed||'');
  }
 }

 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
    if(tz)setZone(tz);
    const {data:{user},error}=await supabaseBrowser().auth.getUser();
    if(error)throw error;
    if(!active)return;
    if(!user){showNotice('Sign in to arrange an appointment.','status');return;}
    setUserId(user.id);
    await refresh();
   }catch(e){
    if(active)setLoadError(e instanceof Error?e.message:'Unable to load appointment calendar');
   }finally{
    if(active)setLoading(false);
   }
  })();
  return()=>{active=false;};
 },[]);

 async function handleManualRefresh(){
  if(refreshing||busy)return;
  setRefreshing(true);
  try{
   await refresh();
   showNotice('Appointments refreshed with the latest TrustFive records.','status',false);
  }catch(e){
   showNotice(e instanceof Error?e.message:'Unable to refresh appointments right now.','error',true);
  }finally{
   setRefreshing(false);
  }
 }

 async function propose(e:FormEvent){
  e.preventDefault();
  if(busy||inFlight.current||!selected)return;
  const begins=new Date(start),finishes=new Date(end);
  const startIso=Number.isFinite(begins.getTime())?begins.toISOString():'';
  const endIso=Number.isFinite(finishes.getTime())?finishes.toISOString():'';
  const cleanZone=zone.trim();
  const validationError=validateAppointmentProposal({
   bookingId:selected,
   startIso,
   endIso,
   timezoneName:cleanZone,
  });
  if(validationError){showNotice(validationError,'error');return;}
  inFlight.current=true;setBusy(true);setBusyActionKey('propose');setNotice('');

  const targetBookingId=selected;
  const result=await executeBookingAction({
   runRpc:async()=>supabaseBrowser().rpc('propose_booking_appointment',{
    p_booking:targetBookingId,
    p_start:startIso,
    p_end:endIso,
    p_timezone:cleanZone,
   }),
   onCommittedLocalUpdate:()=>{
    setAppointments(prev=>{
     const nextItem:ScheduledAppointment={
      booking_id:targetBookingId,
      proposed_by:userId,
      starts_at:startIso,
      ends_at:endIso,
      timezone_name:cleanZone,
      status:'proposed',
     };
     const exists=prev.some(a=>a.booking_id===targetBookingId);
     return exists?prev.map(a=>a.booking_id===targetBookingId?nextItem:a):[...prev,nextItem];
    });
    setStart('');
    setEnd('');
   },
   runRefresh:async()=>{await refresh();},
   successMessage:'Appointment time proposed in '+cleanZone+'. The other participant must confirm it.',
   refreshFailedMessage:'Appointment time proposed and saved in '+cleanZone+', but refreshing the calendar failed. Use “Refresh appointments” to sync.',
   fallbackErrorMessage:'Unable to propose appointment',
  });

  inFlight.current=false;setBusy(false);setBusyActionKey('');
  if(result.outcome==='committed'){
   showNotice(result.message,'status',false);
  }else if(result.outcome==='committed_refresh_failed'){
   showNotice(result.message,'warning',true);
  }else{
   showNotice(result.message,'error',false);
  }
 }

 async function action(bookingId:string,kind:'confirm_booking_appointment'|'cancel_booking_appointment'){
  if(busy||inFlight.current)return;
  if(kind==='confirm_booking_appointment'&&confirmAcceptId!==bookingId)return;
  if(kind==='cancel_booking_appointment'&&confirmCancelId!==bookingId)return;
  inFlight.current=true;setBusy(true);setBusyActionKey(`${kind}:${bookingId}`);setNotice('');

  const nextStatus=kind==='confirm_booking_appointment'?'confirmed':'cancelled';
  const result=await executeBookingAction({
   runRpc:async()=>supabaseBrowser().rpc(kind,{p_booking:bookingId}),
   onCommittedLocalUpdate:()=>{
    setConfirmAcceptId(null);
    setConfirmCancelId(null);
    setAppointments(prev=>applyCommittedAppointmentStatus(prev,bookingId,nextStatus));
   },
   runRefresh:async()=>{await refresh();},
   successMessage:kind==='confirm_booking_appointment'
    ?'Appointment confirmed. Both participants now see the agreed time.'
    :'Appointment time cancelled; the booking itself remains active so a new time can be proposed.',
   refreshFailedMessage:kind==='confirm_booking_appointment'
    ?'Appointment confirmed and saved, but refreshing the calendar failed. Use “Refresh appointments” to sync.'
    :'Appointment cancelled and saved, but refreshing the calendar failed. Use “Refresh appointments” to sync.',
   fallbackErrorMessage:'Could not update appointment',
  });

  inFlight.current=false;setBusy(false);setBusyActionKey('');
  if(result.outcome==='committed'){
   showNotice(result.message,'status',false);
  }else if(result.outcome==='committed_refresh_failed'){
   showNotice(result.message,'warning',true);
  }else{
   showNotice(result.message,'error',false);
  }
 }

 const active=bookings.filter(b=>b.status==='booked'||b.status==='awaiting_customer');
 const summary=summarizeAppointments(appointments,userId);

 return <main className="container bookings-page">
  <div className="page-heading">
   <span className="eyebrow">Agree a time together</span>
   <h1>Booking appointments</h1>
   <div className="bookings-header-actions">
    <Link className="btn secondary" href="/bookings">Back to My bookings</Link>
    <Link className="btn secondary" href="/jobs">My jobs &amp; quotes</Link>
   </div>
   <p className="subtle">Either participant can propose a time. Only the other participant can confirm it. Confirmed appointments preserve their exact IANA time zone and cannot overlap for the same professional.</p>
  </div>

  {notice&&(
   <div
    role={noticeTone==='error'?'alert':'status'}
    aria-live={noticeTone==='error'?'assertive':'polite'}
    className={noticeTone==='error'?'notice error':noticeTone==='warning'?'notice notice-warn':'notice'}
    data-testid="schedule-status-banner"
   >
    <p style={{margin:0}}>{notice}</p>
    {needsManualRefresh&&(
     <div style={{marginTop:10}}>
      <button type="button" className="btn secondary" disabled={refreshing||busy} onClick={()=>void handleManualRefresh()}>
       {refreshing?'Refreshing…':'Refresh appointments'}
      </button>
     </div>
    )}
   </div>
  )}

  {loadError&&(
   <div role="alert" className="notice error">
    <p style={{margin:'0 0 10px'}}>{loadError}</p>
    <button type="button" className="btn secondary" disabled={busy||refreshing} onClick={()=>void handleManualRefresh()}>
     Retry loading appointments
    </button>
   </div>
  )}

  {unavailableBooking&&<p role="alert" className="notice error">That appointment is not available to your account, or the booking is no longer active. Choose an eligible booking below.</p>}

  {loading?<div className="card" role="status" aria-busy="true"><p style={{margin:0}}>Loading your booking appointments…</p></div>:
  !userId?<Link href="/account?next=%2Fschedule" className="btn">Sign in</Link>:
  <>
   <div className="booking-overview" aria-label="Appointment summary">
    <div className="card"><strong>{summary.upcomingConfirmed}</strong><span>Upcoming confirmed</span></div>
    <div className="card"><strong>{summary.awaitingYourConfirmation}</strong><span>Awaiting your confirmation</span></div>
    <div className="card"><strong>{summary.awaitingOtherParty}</strong><span>Awaiting other participant</span></div>
   </div>

   <div className="two-col bookings-workspace">
    <section className="card bookings-list-col">
     <h2>Propose or change a time</h2>
     <form className="form" onSubmit={propose}>
      <label>Booking<select required disabled={busy} value={selected} onChange={e=>setSelected(e.target.value)}>
       <option value="">Choose active booking</option>
       {active.map(b=><option key={b.id} value={b.id}>Booking #{b.id.slice(0,8)} · {b.customer_id===userId?'Customer':'Professional'}</option>)}
      </select></label>
      <label>Start date and time<input type="datetime-local" required disabled={busy} value={start} onChange={e=>setStart(e.target.value)}/></label>
      <label>End date and time<input type="datetime-local" required disabled={busy} value={end} onChange={e=>setEnd(e.target.value)}/></label>
      <label>IANA time zone<input required minLength={3} maxLength={80} disabled={busy} value={zone} onChange={e=>setZone(e.target.value)} placeholder="Europe/London"/></label>
      <button className="btn" disabled={busy||!active.length} type="submit">{busy&&busyActionKey==='propose'?'Saving…':'Propose appointment'}</button>
     </form>
     <p className="muted-note" style={{marginTop:14}}>Dates are saved as exact UTC timestamps alongside the selected IANA time zone and displayed in that stored time zone for both participants. Proposing a new time replaces any prior proposal and requires the other party&apos;s confirmation.</p>
    </section>

    <section className="bookings-side-col">
     <div className="jobs-list-header">
      <h2 style={{margin:0}}>Appointment calendar</h2>
      <button type="button" className="btn secondary jobs-refresh-btn" disabled={refreshing||busy} onClick={()=>void handleManualRefresh()}>
       {refreshing?'Refreshing…':'Refresh'}
      </button>
     </div>
     <div className="list">
      {bookings.length===0&&<div className="card">No bookings yet. <Link href="/jobs">Post a job</Link> to get started.</div>}
      {bookings.map(b=>{
       const a=appointments.find(v=>v.booking_id===b.id);
       const statusMeta=getBookingStatusMeta(b.status);
       return <article className="card booking-card" id={'booking-'+b.id} key={b.id} style={selected===b.id?{borderColor:'#087c46',boxShadow:'0 0 0 2px #d2ebdb'}:undefined}>
        <div className="job-card-head">
         <span className={`booking-status-pill is-${statusMeta.tone}`}>
          <span className="job-status-dot" aria-hidden="true"/>
          {statusMeta.badgeLabel}
         </span>
         <span className="muted-note">Booking #{b.id.slice(0,8)}</span>
        </div>
        <p style={{marginTop:10}}><Link className="job-related-link" href={bookingHistoryHref(b.id)}>Open booking details →</Link></p>
        {!a?<p className="muted-note" style={{marginTop:10}}>No time has been proposed yet.</p>:<>
         <p className="booking-appointment-note" style={{marginTop:10}}>
          <strong>Appointment ({a.status}):</strong> {formatAppointmentWindow(a.starts_at,a.ends_at,a.timezone_name)}
         </p>

         {a.status==='proposed'&&a.proposed_by!==userId&&(
          confirmAcceptId===b.id?(
           <div
            className="job-confirm-panel"
            role="group"
            aria-label={'Confirm proposed appointment for booking '+b.id.slice(0,8)}
            onKeyDown={e=>{if(e.key==='Escape'&&!busy)setConfirmAcceptId(null);}}
           >
            <h4>Confirm this appointment time?</h4>
            <p className="muted-note">{formatAppointmentWindow(a.starts_at,a.ends_at,a.timezone_name)}</p>
            <div className="job-confirm-actions">
             <button type="button" className="btn" disabled={busy} onClick={()=>void action(b.id,'confirm_booking_appointment')}>
              {busy&&busyActionKey===`confirm_booking_appointment:${b.id}`?'Confirming…':'Confirm appointment time'}
             </button>
             <button type="button" className="btn secondary" disabled={busy} onClick={()=>setConfirmAcceptId(null)}>Go back</button>
            </div>
           </div>
          ):(
           <div className="job-actions-bar">
            <button type="button" className="btn" disabled={busy} onClick={()=>{setConfirmAcceptId(b.id);setConfirmCancelId(null);setNotice('');}}>
             Accept proposed time
            </button>
           </div>
          )
         )}

         {a.status==='proposed'&&a.proposed_by===userId&&<p className="muted-note" style={{marginTop:8}}>Awaiting the other participant&apos;s confirmation.</p>}

         {(a.status==='confirmed'||a.status==='proposed')&&(
          confirmCancelId===b.id?(
           <div
            className="job-confirm-panel is-cancel"
            role="group"
            aria-label={'Confirm cancelling appointment for booking '+b.id.slice(0,8)}
            onKeyDown={e=>{if(e.key==='Escape'&&!busy)setConfirmCancelId(null);}}
           >
            <h4>Cancel this appointment time?</h4>
            <p className="muted-note">The booking stays active so you can propose a new time.</p>
            <div className="job-confirm-actions">
             <button type="button" className="btn job-btn-danger" disabled={busy} onClick={()=>void action(b.id,'cancel_booking_appointment')}>
              {busy&&busyActionKey===`cancel_booking_appointment:${b.id}`?'Cancelling…':'Confirm cancellation'}
             </button>
             <button type="button" className="btn secondary" disabled={busy} onClick={()=>setConfirmCancelId(null)}>Keep time</button>
            </div>
           </div>
          ):(
           <div className="job-actions-bar">
            <button type="button" className="btn secondary job-btn-danger-outline" disabled={busy} onClick={()=>{setConfirmCancelId(b.id);setConfirmAcceptId(null);setNotice('');}}>
             Cancel appointment time
            </button>
           </div>
          )
         )}
        </>}
       </article>;
      })}
     </div>
    </section>
   </div>
  </>}
 </main>;
}
