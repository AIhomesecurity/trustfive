'use client';
import {FormEvent,useEffect,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import {authorisedBookingSelection,bookingHistoryHref} from '../../lib/workflow-links';
import {canManageBookingAppointment} from '../../lib/booking-appointment-guard';
type Booking={id:string;customer_id:string;professional_id:string;status:string};
type Appointment={booking_id:string;proposed_by:string;starts_at:string;ends_at:string;timezone_name:string;status:string};
export default function BookingSchedule(){
 const [userId,setUserId]=useState(''),[bookings,setBookings]=useState<Booking[]>([]);
 const [appointments,setAppointments]=useState<Appointment[]>([]);
 const [selected,setSelected]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState('');
 const [zone,setZone]=useState('Europe/London'),[notice,setNotice]=useState('Loading your bookings…'),[busy,setBusy]=useState(false);
 const [unavailableBooking,setUnavailableBooking]=useState(false);
 async function refresh(){
  const s=supabaseBrowser();const [b,a]=await Promise.all([
   s.from('job_bookings').select('id,customer_id,professional_id,status').order('created_at',{ascending:false}),
   s.from('booking_appointments').select('booking_id,proposed_by,starts_at,ends_at,timezone_name,status')
  ]);
  if(b.error)throw b.error;if(a.error)throw a.error;
  const current=b.data||[];
  setBookings(current);setAppointments(a.data||[]);
  const requested=new URLSearchParams(window.location.search).get('booking');
  if(requested){
   const eligible=current.filter(b=>canManageBookingAppointment(b.id,current,userId)).map(b=>b.id);
   const allowed=authorisedBookingSelection(requested,eligible);
   setUnavailableBooking(!allowed);
   if(allowed)setSelected(allowed);
   else setSelected('');
  }
 }
 useEffect(()=>{(async()=>{try{
  const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
  if(tz)setZone(tz);
  const {data:{user},error}=await supabaseBrowser().auth.getUser();
  if(error)throw error;
  if(!user){setNotice('Sign in to arrange an appointment.');return;}
  setUserId(user.id);await refresh();setNotice('');
 }catch(e){setNotice(e instanceof Error?e.message:'Unable to load appointment calendar')}})()},[]);
 async function propose(e:FormEvent){e.preventDefault();if(busy||!selected)return;
  if(!canManageBookingAppointment(selected,bookings,userId)){
   setNotice('This booking is no longer eligible for appointment changes. Refresh your bookings.');return;
  }
  setBusy(true);setNotice('');
  try{
   const begins=new Date(start),finishes=new Date(end);
   if(!Number.isFinite(begins.getTime())||!Number.isFinite(finishes.getTime())||finishes<=begins)throw Error('Enter a valid start and end time');
   const {error}=await supabaseBrowser().rpc('propose_booking_appointment',{
    p_booking:selected,p_start:begins.toISOString(),p_end:finishes.toISOString(),p_timezone:zone
   });
   if(error)throw error;
   await refresh();setNotice('Appointment time proposed. The other participant must confirm it.');
  }catch(e){setNotice(e instanceof Error?e.message:'Unable to propose appointment');}
  finally{setBusy(false);}
 }
 async function action(bookingId:string,kind:'confirm_booking_appointment'|'cancel_booking_appointment'){
  if(busy)return;
  if(!canManageBookingAppointment(bookingId,bookings,userId)){
   setNotice('This booking is no longer eligible for appointment changes. Refresh your bookings.');return;
  }
  setBusy(true);setNotice('');
  try{
   const {error}=await supabaseBrowser().rpc(kind,{p_booking:bookingId});
   if(error)throw error;await refresh();
   setNotice(kind==='confirm_booking_appointment'?'Appointment confirmed.':'Appointment time cancelled; the booking itself remains active.');
  }catch(e){setNotice(e instanceof Error?e.message:'Could not update appointment');}
  finally{setBusy(false);}
 }
 const active=bookings.filter(b=>canManageBookingAppointment(b.id,bookings,userId));
 return <main className="container">
  <div className="page-heading"><span className="eyebrow">Agree a time together</span><h1>Booking appointments</h1>
  <p className="subtle">Either participant can propose a time. Only the other participant can confirm it. Confirmed appointments cannot overlap for the same professional.</p></div>
  {notice&&<p role="status" className="notice">{notice}</p>}
  {unavailableBooking&&<p role="alert" className="notice">That appointment is not available to your account, or the booking is no longer active. Choose an eligible booking below.</p>}
  {!userId?<Link href="/account" className="btn">Sign in</Link>:
  <div className="two-col">
   <section className="card"><h2>Propose or change a time</h2>
    <form className="form" onSubmit={propose}>
     <label>Booking<select required value={selected} onChange={e=>setSelected(e.target.value)}>
      <option value="">Choose active booking</option>{active.map(b=><option key={b.id} value={b.id}>Booking #{b.id.slice(0,8)} · {b.customer_id===userId?'Customer':'Professional'}</option>)}
     </select></label>
     <label>Start date and time<input type="datetime-local" required value={start} onChange={e=>setStart(e.target.value)}/></label>
     <label>End date and time<input type="datetime-local" required value={end} onChange={e=>setEnd(e.target.value)}/></label>
     <label>IANA time zone<input required minLength={3} maxLength={80} value={zone} onChange={e=>setZone(e.target.value)} placeholder="Europe/London"/></label>
     <button className="btn" disabled={busy} type="submit">Propose appointment</button>
    </form>
    <p className="muted-note">Date/time inputs use your device's time zone; we store the exact UTC timestamps and time-zone identifier. This is a scheduling request, not an automatic payment or booking cancellation.</p>
   </section>
   <section><h2>Appointment calendar</h2><div className="list">
    {bookings.length===0&&<div className="card">No bookings yet. <Link href="/jobs">Post a job</Link> to get started.</div>}
    {bookings.map(b=>{const a=appointments.find(v=>v.booking_id===b.id);return <article className="card" id={'booking-'+b.id} key={b.id} style={selected===b.id?{borderColor:'#087c46'}:undefined}>
     <span className="pill">{b.status}</span><h3 style={{marginTop:12}}>Booking #{b.id.slice(0,8)}</h3><p className="muted-note"><Link href={bookingHistoryHref(b.id)}>Open booking details →</Link></p>
     {!a?<p>No time has been proposed yet.</p>:<>
      <p><strong>Appointment:</strong> {a.status}</p>
      <p>{new Date(a.starts_at).toLocaleString('en-GB')} — {new Date(a.ends_at).toLocaleString('en-GB')}</p>
      <p className="muted-note">Time zone: {a.timezone_name}</p>
      {a.status==='proposed'&&a.proposed_by!==userId&&
       <button className="btn" disabled={busy} onClick={()=>action(b.id,'confirm_booking_appointment')}>Accept proposed time</button>}
      {a.status==='proposed'&&a.proposed_by===userId&&<p className="muted-note">Awaiting the other participant's confirmation</p>}
      {(a.status==='confirmed'||a.status==='proposed')&&
       <p style={{marginTop:10}}><button className="btn secondary" disabled={busy} onClick={()=>action(b.id,'cancel_booking_appointment')}>Cancel appointment time</button></p>}
     </>}
    </article>})}
   </div></section>
  </div>}
 </main>;
}
