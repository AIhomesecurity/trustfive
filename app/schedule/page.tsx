'use client';
import {FormEvent,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import {executeBookingAction} from '../../lib/booking-lifecycle';
import {bookingHistoryHref} from '../../lib/workflow-links';
import {
  formatAppointmentWindow,
  resolveAppointmentBooking,
  retainAppointmentSelection,
  summarizeAppointments,
  validateAppointmentProposal,
  type ScheduledAppointment,
} from '../../lib/appointment-schedule';

type Booking={id:string;customer_id:string;professional_id:string;status:string};

export default function BookingSchedule(){
 const [userId,setUserId]=useState('');
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [appointments,setAppointments]=useState<ScheduledAppointment[]>([]);
 const [selected,setSelected]=useState('');
 const [start,setStart]=useState('');
 const [end,setEnd]=useState('');
 const [zone,setZone]=useState('Europe/London');
 const [notice,setNotice]=useState('');
 const [loadError,setLoadError]=useState('');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [confirmCancelId,setConfirmCancelId]=useState<string|null>(null);
 const [unavailableBooking,setUnavailableBooking]=useState(false);
 const inFlight=useRef(false);
 const hasLoaded=useRef(false);

 async function refresh(accountId:string){
  const initial=!hasLoaded.current;
  const s=supabaseBrowser();
  const b=await s.from('job_bookings')
   .select('id,customer_id,professional_id,status')
   .or('customer_id.eq.'+accountId+',professional_id.eq.'+accountId)
   .order('created_at',{ascending:false})
   .limit(75);
  if(b.error)throw b.error;
  const requested=new URLSearchParams(window.location.search).getAll('booking');
  const result=await resolveAppointmentBooking(requested,(b.data||[]) as Booking[],accountId,async id=>{
   const {data,error}=await s.from('job_bookings')
    .select('id,customer_id,professional_id,status')
    .or('customer_id.eq.'+accountId+',professional_id.eq.'+accountId)
    .eq('id',id).maybeSingle();
   if(error)throw error;
   return data as Booking|null;
  });
  const current=result.bookings;
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
  setBookings(current);
  setLoadError('');
  setUnavailableBooking(requested.length>0&&!result.selectedId);
  setSelected(previous=>initial?result.selectedId:retainAppointmentSelection(previous,current,accountId));
  hasLoaded.current=true;
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
    if(!user){setNotice('Sign in to arrange an appointment.');return;}
    setUserId(user.id);
    await refresh(user.id);
   }catch(e){
    if(active)setLoadError(e instanceof Error?e.message:'Unable to load appointment calendar');
   }finally{
    if(active)setLoading(false);
   }
  })();
  return()=>{active=false;};
 },[]);

 async function propose(e:FormEvent){
  e.preventDefault();
  if(busy||inFlight.current||loadError||!selected)return;
  const begins=new Date(start),finishes=new Date(end);
  const validationError=validateAppointmentProposal({
   bookingId:selected,
   startIso:Number.isFinite(begins.getTime())?begins.toISOString():'',
   endIso:Number.isFinite(finishes.getTime())?finishes.toISOString():'',
   timezoneName:zone,
  });
  if(validationError){setNotice(validationError);return;}
  inFlight.current=true;setBusy(true);setNotice('');
  try{
   const result=await executeBookingAction({
    runRpc:async()=>supabaseBrowser().rpc('propose_booking_appointment',{
     p_booking:selected,
     p_start:begins.toISOString(),
     p_end:finishes.toISOString(),
     p_timezone:zone.trim(),
    }),
    onCommittedLocalUpdate:()=>{setStart('');setEnd('');},
    runRefresh:()=>refresh(userId),
    successMessage:'Appointment time proposed in '+zone.trim()+'. The other participant must confirm it.',
    refreshFailedMessage:'Appointment time proposed. Reload the calendar to see the latest details.',
    fallbackErrorMessage:'Unable to propose appointment',
   });
   showActionResult(result);
  } finally{inFlight.current=false;setBusy(false);}
 }

 async function action(bookingId:string,kind:'confirm_booking_appointment'|'cancel_booking_appointment'){
  if(busy||inFlight.current||loadError)return;
  inFlight.current=true;setBusy(true);setNotice('');
  try{
   const confirmed=kind==='confirm_booking_appointment';
   const result=await executeBookingAction({
    runRpc:async()=>supabaseBrowser().rpc(kind,{p_booking:bookingId}),
    onCommittedLocalUpdate:()=>setConfirmCancelId(null),
    runRefresh:()=>refresh(userId),
    successMessage:confirmed?'Appointment confirmed. Both participants now see the agreed time.'
     :'Appointment time cancelled; the booking itself remains active so a new time can be proposed.',
    refreshFailedMessage:(confirmed?'Appointment confirmed.':'Appointment time cancelled.')+' Reload the calendar to see the latest details.',
    fallbackErrorMessage:'Could not update appointment',
   });
   showActionResult(result);
  } finally{inFlight.current=false;setBusy(false);}
 }

 function showActionResult(result:Awaited<ReturnType<typeof executeBookingAction>>){
  setNotice(result.message);
  if(result.outcome==='committed_refresh_failed')setLoadError('Calendar updates are paused until the latest appointments load.');
 }

 async function retryCalendar(){
  if(inFlight.current)return;
  inFlight.current=true;setBusy(true);
  try{
   const id=userId||(await supabaseBrowser().auth.getUser()).data.user?.id;
   if(!id)throw Error('Sign in again to reload your appointments.');
   setUserId(id);await refresh(id);
  }
  catch(e){setLoadError(e instanceof Error?e.message:'Could not reload the appointment calendar');}
  finally{inFlight.current=false;setBusy(false);}
 }

 const active=bookings.filter(b=>b.status==='booked'||b.status==='awaiting_customer');
 const summary=summarizeAppointments(appointments,userId);

 return <main className="container">
  <div className="page-heading">
   <span className="eyebrow">Agree a time together</span>
   <h1>Booking appointments</h1>
   <p className="subtle">Either participant can propose a time. Only the other participant can confirm it. Confirmed appointments preserve their exact IANA time zone and cannot overlap for the same professional.</p>
  </div>
  {notice&&<p role="status" className="notice">{notice}</p>}
  {loadError&&<div role="alert" className="notice error"><p>{loadError}</p><button type="button" className="btn secondary" disabled={busy} onClick={()=>void retryCalendar()}>Retry loading appointments</button></div>}
  {unavailableBooking&&<p role="alert" className="notice">That appointment is not available to your account, or the booking is no longer active. Choose an eligible booking below.</p>}
  {loading?<p role="status" className="notice">Loading your booking appointments…</p>:
  !userId?<Link href="/account?next=%2Fschedule" className="btn">Sign in</Link>:
  <>
   <div className="grid" style={{marginBottom:22}} aria-label="Appointment summary">
    <div className="card"><h3>{summary.upcomingConfirmed}</h3><p>Upcoming confirmed</p></div>
    <div className="card"><h3>{summary.awaitingYourConfirmation}</h3><p>Awaiting your confirmation</p></div>
    <div className="card"><h3>{summary.awaitingOtherParty}</h3><p>Awaiting other participant</p></div>
   </div>
   <div className="two-col">
    <section className="card">
     <h2>Propose or change a time</h2>
     <form className="form" onSubmit={propose}>
      <label>Booking<select required value={selected} onChange={e=>setSelected(e.target.value)}>
       <option value="">Choose active booking</option>
       {active.map(b=><option key={b.id} value={b.id}>Booking #{b.id.slice(0,8)} · {b.customer_id===userId?'Customer':'Professional'}</option>)}
      </select></label>
      <label>Start date and time<input type="datetime-local" required value={start} onChange={e=>setStart(e.target.value)}/></label>
      <label>End date and time<input type="datetime-local" required value={end} onChange={e=>setEnd(e.target.value)}/></label>
      <label>IANA time zone<input required minLength={3} maxLength={80} value={zone} onChange={e=>setZone(e.target.value)} placeholder="Europe/London"/></label>
      <button className="btn" disabled={busy||Boolean(loadError)||!active.length} type="submit">{busy?'Saving…':'Propose appointment'}</button>
     </form>
     <p className="muted-note" style={{marginTop:14}}>Dates are saved as exact UTC timestamps alongside the selected IANA time zone and displayed in that stored time zone for both participants. Proposing a new time replaces any prior proposal and requires the other party's confirmation.</p>
    </section>
    <section>
     <h2>Appointment calendar</h2>
     <div className="list">
      {bookings.length===0&&<div className="card">No bookings yet. <Link href="/jobs">Post a job</Link> to get started.</div>}
      {bookings.map(b=>{
       const a=appointments.find(v=>v.booking_id===b.id);
       return <article className="card" id={'booking-'+b.id} key={b.id} style={selected===b.id?{borderColor:'#087c46'}:undefined}>
        <span className="pill">{b.status.replace('_',' ')}</span>
        <h3 style={{marginTop:12}}>Booking #{b.id.slice(0,8)}</h3>
        <p className="muted-note"><Link href={bookingHistoryHref(b.id)}>Open booking details →</Link></p>
        {!a?<p style={{marginTop:10}}>No time has been proposed yet.</p>:<>
         <p style={{marginTop:10}}><strong>Appointment:</strong> {a.status}</p>
         <p>{formatAppointmentWindow(a.starts_at,a.ends_at,a.timezone_name)}</p>
         {a.status==='proposed'&&a.proposed_by!==userId&&
          <button type="button" className="btn" style={{marginTop:10}} disabled={busy||Boolean(loadError)} onClick={()=>void action(b.id,'confirm_booking_appointment')}>Accept proposed time</button>}
         {a.status==='proposed'&&a.proposed_by===userId&&<p className="muted-note" style={{marginTop:8}}>Awaiting the other participant's confirmation.</p>}
         {(a.status==='confirmed'||a.status==='proposed')&&(
          confirmCancelId===b.id?
          <div className="notice" style={{marginTop:10}} role="group" aria-label={'Confirm cancelling appointment for booking '+b.id.slice(0,8)}>
           <p>Cancel this appointment time? The booking stays active so you can agree a new time.</p>
           <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
            <button type="button" className="btn secondary" disabled={busy||Boolean(loadError)} onClick={()=>void action(b.id,'cancel_booking_appointment')}>Confirm cancellation</button>
            <button type="button" className="btn secondary" disabled={busy} onClick={()=>setConfirmCancelId(null)}>Keep time</button>
           </div>
          </div>:
          <p style={{marginTop:10}}><button type="button" className="btn secondary" disabled={busy||Boolean(loadError)} onClick={()=>setConfirmCancelId(b.id)}>Cancel appointment time</button></p>
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
