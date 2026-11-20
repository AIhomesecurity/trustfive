'use client';
import {FormEvent,useEffect,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import {loadBookingSiteBatch} from '../../lib/booking-site-batch';
import {quoteMessagesHref,bookingScheduleHref,authorisedBookingSelection} from '../../lib/workflow-links';
type Booking={id:string;quote_id:string;job_id:string;customer_id:string;professional_id:string;status:string;created_at:string};
type Review={booking_id:string};
type JobSite={address_label:string;postcode:string|null;sharing_enabled:boolean};
export default function Bookings(){
 const [userId,setUserId]=useState(''),[bookings,setBookings]=useState<Booking[]>([]),[reviews,setReviews]=useState<Review[]>([]);
 const [sites,setSites]=useState<Record<string,JobSite|null>>({}),[siteBusy,setSiteBusy]=useState('');
 const [siteUnavailableIds,setSiteUnavailableIds]=useState<string[]>([]),[checkingAccount,setCheckingAccount]=useState(true);
 const [loadingBookings,setLoadingBookings]=useState(false);
 const [focusBooking,setFocusBooking]=useState(''),[unavailableBooking,setUnavailableBooking]=useState(false);
 const [selected,setSelected]=useState<Booking|null>(null),[stars,setStars]=useState('5'),[body,setBody]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function refresh(user:string){
  setLoadingBookings(true);
  try{
   const s=supabaseBrowser();
   const [b,r]=await Promise.all([
    s.from('job_bookings').select('id,quote_id,job_id,customer_id,professional_id,status,created_at')
     .or('customer_id.eq.'+user+',professional_id.eq.'+user).order('created_at',{ascending:false}).limit(75),
    s.from('booking_reviews').select('booking_id').eq('author_id',user)
   ]);
   if(b.error)throw b.error;
   if(r.error)throw r.error;
   const records=b.data||[];
   // Clear previous address data before any renewed access check, including after revocation.
   setSites({});setSiteUnavailableIds([]);
   setBookings(records);setReviews(r.data||[]);
   const requested=new URLSearchParams(window.location.search).get('booking');
   setFocusBooking(authorisedBookingSelection(requested,records.map(b=>b.id)));
   setUnavailableBooking(Boolean(requested&&!records.some(b=>b.id===requested)));
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
   setSites(loadedSites);
   setSiteUnavailableIds(unavailableIds);
  }finally{setLoadingBookings(false);}
 }
 useEffect(()=>{(async()=>{try{const {data:{user},error}=await supabaseBrowser().auth.getUser();if(error)throw error;if(!user){setNotice('Sign in to manage your bookings.');return}setUserId(user.id);await refresh(user.id)}catch(e){setNotice(e instanceof Error?e.message:'Unable to load bookings')}finally{setCheckingAccount(false)}})()},[]);
 async function act(action:'mark_job_ready_for_confirmation'|'confirm_job_completed',id:string){setBusy(true);try{const {error}=await supabaseBrowser().rpc(action,{p_booking:id});if(error)throw error;await refresh(userId);setNotice(action==='confirm_job_completed'?'Job completion confirmed. You can now leave a review.':'The customer can now confirm job completion.')}catch(e){setNotice(e instanceof Error?e.message:'Unable to update booking')}finally{setBusy(false)}}
 async function shareAddress(booking:Booking,enabled:boolean){if(busy||siteBusy)return;setSiteBusy(booking.id);setNotice('');try{const {error}=await supabaseBrowser().rpc('set_booking_address_sharing',{p_booking:booking.id,p_allow:enabled});if(error)throw error;await refresh(userId);setNotice(enabled?'Your selected address is now available to this booked professional.':'Exact address sharing has been turned off for this booking.')}catch(e){setNotice(e instanceof Error?e.message:'Unable to update address sharing')}finally{setSiteBusy('')}}
 async function review(e:FormEvent){e.preventDefault();if(!selected||busy)return;setBusy(true);try{const rating=Number(stars);const {error}=await supabaseBrowser().from('booking_reviews').insert({booking_id:selected.id,author_id:userId,professional_id:selected.professional_id,stars:rating,body:body.trim()});if(error)throw error;await refresh(userId);setNotice('Review submitted for a confirmed completed booking.');setSelected(null);setBody('')}catch(e){setNotice(e instanceof Error?e.message:'Unable to submit review')}finally{setBusy(false)}}
 return <main className="container"><div className="page-heading"><span className="eyebrow">Bookings and quality</span><h1>My bookings</h1><p><Link className="btn secondary" href="/schedule">Manage appointment times</Link></p><p className="subtle">Professionals mark work ready; customers confirm completion. Reviews are linked to confirmed completed bookings.</p></div>{notice&&<p className="notice" role="status">{notice}</p>}
 {checkingAccount?<p className="notice" role="status" aria-live="polite">Checking your account and loading bookings…</p>:
 !userId?<Link className="btn" href="/account?next=%2Fbookings">Sign in to see your bookings</Link>:
 <><div className="booking-overview">
  <div className="card"><strong>{bookings.length}</strong><span>Recent bookings</span></div>
  <div className="card"><strong>{bookings.filter(b=>b.status==='booked'||b.status==='awaiting_customer').length}</strong><span>Active bookings</span></div>
  <div className="card"><strong>{bookings.filter(b=>b.status==='awaiting_customer'&&b.customer_id===userId).length}</strong><span>Awaiting your confirmation</span></div>
 </div>
 {unavailableBooking&&<p role="alert" className="notice">That booking is not accessible to this account. Only your own bookings are listed below.</p>}
 {focusBooking&&<p role="status" className="notice">Showing your selected booking below. You can also review all your other bookings.</p>}
 {siteUnavailableIds.length>0&&<div className="notice" role="status">Booking history is available, but private address sharing could not be checked for {siteUnavailableIds.length} booking{siteUnavailableIds.length===1?'':'s'}. No address will be displayed until its access check succeeds. <button type="button" className="btn secondary" disabled={loadingBookings} onClick={()=>void refresh(userId).catch(e=>setNotice(e instanceof Error?e.message:'Could not refresh bookings'))}>Retry address checks</button></div>}
 <div className="two-col"><section><h2>Booking history</h2><div className="list">{bookings.length===0?<div className="card">No confirmed bookings yet. <Link href="/jobs">Post a job</Link> to get started.</div>:bookings.map(b=><article className="card" id={"booking-"+b.id} key={b.id} style={focusBooking===b.id?{borderColor:"#087c46",boxShadow:"0 0 0 2px #d2ebdb"}:undefined}><span className="pill">{b.status.replace('_',' ')}</span><p style={{marginTop:12}}>Booking #{b.id.slice(0,8)}</p><p className="muted-note">{new Date(b.created_at).toLocaleDateString('en-GB')} · {b.customer_id===userId?'Customer':'Professional'}</p><p style={{marginTop:15}}><Link href={quoteMessagesHref(b.quote_id)}>Open quote conversation →</Link> · <Link href={bookingScheduleHref(b.id)}>Manage appointment →</Link></p>{b.customer_id===userId&&sites[b.id]&&<div className="notice"><h3>Private job-site address</h3><p>{sites[b.id]?.address_label}</p><p className="muted-note">Only you can share your full address with the professional who has this booking. It is never shown in public leads.</p>{(b.status==='booked'||b.status==='awaiting_customer')&&<label style={{display:'flex',alignItems:'center',gap:10}}><input type="checkbox" style={{width:18}} checked={Boolean(sites[b.id]?.sharing_enabled)} disabled={Boolean(siteBusy||busy)} onChange={e=>shareAddress(b,e.target.checked)}/> Share exact address with this booked professional</label>}{sites[b.id]?.sharing_enabled&&<p className="muted-note">Sharing enabled. Turn this off to stop further access in TrustFive.</p>}</div>}{b.professional_id===userId&&(b.status==='booked'||b.status==='awaiting_customer')&&<div className="notice"><h3>Job-site address</h3>{loadingBookings?<p className="muted-note" role="status">Checking customer address consent…</p>:siteUnavailableIds.includes(b.id)?<p className="muted-note">Address access check is temporarily unavailable. Please retry; no address is displayed without confirmation.</p>:sites[b.id]?<p>{sites[b.id]?.address_label}</p>:<p className="muted-note">The customer has not shared the exact address. Request their permission through messages.</p>}</div>}{b.professional_id===userId&&b.status==='booked'&&<button className="btn" disabled={busy} onClick={()=>act('mark_job_ready_for_confirmation',b.id)}>Mark work ready</button>}{b.customer_id===userId&&b.status==='awaiting_customer'&&<button className="btn" disabled={busy} onClick={()=>act('confirm_job_completed',b.id)}>Confirm work completed</button>}{b.customer_id===userId&&b.status==='completed'&&!reviews.some(r=>r.booking_id===b.id)&&<p style={{marginTop:10}}><button className="btn secondary" onClick={()=>setSelected(b)}>Leave verified-booking review</button></p>}{reviews.some(r=>r.booking_id===b.id)&&<p className="muted-note">Review submitted</p>}</article>)}</div></section><section>{selected&&<div className="card"><h2>Review a completed job</h2><p className="subtle">Your review must describe your actual experience. It will be public.</p><form className="form" onSubmit={review}><label>Overall rating<select value={stars} onChange={e=>setStars(e.target.value)}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} star{n!==1?'s':''}</option>)}</select></label><label>Your experience<textarea required minLength={10} maxLength={1500} value={body} onChange={e=>setBody(e.target.value)}/></label><button className="btn" disabled={busy} type="submit">Submit review</button><button className="btn secondary" type="button" onClick={()=>setSelected(null)}>Cancel</button></form></div>}<div className="card"><h3>Fair reviews</h3><p>Only the customer on a completed TrustFive booking can create a booking review. Payment disputes and allegations of misconduct must be investigated independently.</p></div></section></div></>}</main>;
}
