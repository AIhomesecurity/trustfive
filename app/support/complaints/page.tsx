'use client';
import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../../lib/supabase';
import {
  COMPLAINT_ISSUE_OPTIONS,
  filterComplaintsByStatus,
  formatComplaintCategoryLabel,
  isOpenComplaintStatus,
  resolveComplaintSubmission,
  type ComplaintIssueKey,
  type ComplaintStatusFilter,
} from '../../../lib/booking-complaints';

type Booking={id:string;customer_id:string;professional_id:string;status:string};
type Complaint={id:string;booking_id:string;reporter_id:string;respondent_id:string;category:string;statement:string;respondent_statement:string|null;resolution_reason:string|null;status:string;created_at:string};
type Appeal={id:string;complaint_id:string;status:string;review_note?:string|null};

export default function Complaints(){
 const [userId,setUserId]=useState('');
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [cases,setCases]=useState<Complaint[]>([]);
 const [appeals,setAppeals]=useState<Appeal[]>([]);
 const [booking,setBooking]=useState('');
 const [issueType,setIssueType]=useState<ComplaintIssueKey>('quality');
 const [statement,setStatement]=useState('');
 const [statusFilter,setStatusFilter]=useState<ComplaintStatusFilter>('all');
 const [replyTo,setReplyTo]=useState('');
 const [response,setResponse]=useState('');
 const [appealFor,setAppealFor]=useState('');
 const [appealReason,setAppealReason]=useState('');
 const [loading,setLoading]=useState(true);
 const [loadError,setLoadError]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [messageIsError,setMessageIsError]=useState(false);

 const inFlight=useRef(false);
 const noticeRef=useRef<HTMLParagraphElement>(null);

 useEffect(()=>{
  if(message&&messageIsError)noticeRef.current?.focus();
 },[message,messageIsError]);

 async function refresh(){
  setLoadError('');
  const s=supabaseBrowser();
  const [b,c,a]=await Promise.all([
   s.from('job_bookings').select('id,customer_id,professional_id,status').order('created_at',{ascending:false}).limit(50),
   s.from('booking_complaints').select('id,booking_id,reporter_id,respondent_id,category,statement,respondent_statement,resolution_reason,status,created_at').order('created_at',{ascending:false}).limit(50),
   s.from('complaint_appeals').select('id,complaint_id,status,review_note').limit(50)
  ]);
  if(b.error)throw b.error;
  if(c.error)throw c.error;
  if(a.error)throw a.error;
  setBookings((b.data||[]) as Booking[]);
  setCases((c.data||[]) as Complaint[]);
  setAppeals((a.data||[]) as Appeal[]);
 }

 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const {data:{user},error}=await supabaseBrowser().auth.getUser();
    if(error)throw error;
    if(!active)return;
    if(!user){setMessageIsError(false);setMessage('Sign in to request assistance.');return;}
    setUserId(user.id);
    await refresh();
   }catch(e){
    if(active)setLoadError(e instanceof Error?e.message:'Could not load support cases');
   }finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[]);

 function readErrorMessage(err:unknown,fallback:string):string{
  if(err instanceof Error&&err.message)return err.message;
  if(err&&typeof err==='object'&&'message' in err&&typeof (err as {message?:unknown}).message==='string'&&(err as {message:string}).message.trim()){
   return (err as {message:string}).message;
  }
  return fallback;
 }

 async function file(e:FormEvent){
  e.preventDefault();
  if(busy||inFlight.current)return;
  const resolved=resolveComplaintSubmission(issueType,statement);
  if(resolved.error){setMessageIsError(true);setMessage(resolved.error);return;}
  const b=bookings.find(x=>x.id===booking);
  if(!b){setMessageIsError(true);setMessage('Choose a booking before submitting a concern.');return;}
  inFlight.current=true;setBusy(true);setMessage('');setMessageIsError(false);
  try{
   const respondent=b.customer_id===userId?b.professional_id:b.customer_id;
   const {error}=await supabaseBrowser().from('booking_complaints').insert({
    booking_id:booking,reporter_id:userId,respondent_id:respondent,category:resolved.dbCategory,statement:resolved.statement,status:'submitted'
   });
   if(error)throw error;
   await refresh();
   setStatement('');setBooking('');
   setMessageIsError(false);
   setMessage('Your confidential case has been recorded for human review. No automatic suspension or removal will happen.');
  }catch(e){
   setMessageIsError(true);
   setMessage(readErrorMessage(e,'Could not create case'));
  }finally{inFlight.current=false;setBusy(false);}
 }

 async function respond(e:FormEvent){
  e.preventDefault();
  if(!replyTo||busy||inFlight.current)return;
  if(response.trim().length<20){setMessageIsError(true);setMessage('Provide at least 20 characters in your response.');return;}
  inFlight.current=true;setBusy(true);setMessage('');setMessageIsError(false);
  try{
   const {error}=await supabaseBrowser().rpc('respond_to_booking_complaint',{p_complaint:replyTo,p_response:response.trim()});
   if(error)throw error;
   await refresh();
   setReplyTo('');setResponse('');
   setMessageIsError(false);
   setMessage('Your response was recorded for the independent reviewer.');
  }catch(e){
   setMessageIsError(true);
   setMessage(readErrorMessage(e,'Could not save response'));
  }finally{inFlight.current=false;setBusy(false);}
 }

 async function appeal(e:FormEvent){
  e.preventDefault();
  if(!appealFor||busy||inFlight.current)return;
  if(appealReason.trim().length<30){setMessageIsError(true);setMessage('Explain your appeal grounds in at least 30 characters.');return;}
  inFlight.current=true;setBusy(true);setMessage('');setMessageIsError(false);
  try{
   const {error}=await supabaseBrowser().from('complaint_appeals').insert({
    complaint_id:appealFor,appellant_id:userId,reason:appealReason.trim(),status:'pending'
   });
   if(error)throw error;
   await refresh();
   setAppealFor('');setAppealReason('');
   setMessageIsError(false);
   setMessage('Appeal submitted for independent human review.');
  }catch(e){
   setMessageIsError(true);
   setMessage(readErrorMessage(e,'Unable to submit appeal'));
  }finally{inFlight.current=false;setBusy(false);}
 }

 const selectedIssue=useMemo(
  ()=>COMPLAINT_ISSUE_OPTIONS.find(o=>o.key===issueType)??COMPLAINT_ISSUE_OPTIONS[0],
  [issueType]
 );
 const openCount=useMemo(()=>cases.filter(c=>isOpenComplaintStatus(c.status)).length,[cases]);
 const resolvedCount=cases.length-openCount;
 const visibleCases=useMemo(()=>filterComplaintsByStatus(cases,statusFilter),[cases,statusFilter]);

 return <main className="container">
  <div className="page-heading">
   <span className="eyebrow">Fairness and accountability</span>
   <h1>Complaints and appeals</h1>
   <p className="subtle">Raise a private booking-related concern, report a no-show or missed appointment, respond to an allegation, or appeal an investigated decision. Complaints are handled privately by human reviewers — never published as public reviews and never triggering automated suspension.</p>
   <p className="muted-note">Looking to leave ordinary feedback after completed work instead of a formal dispute? <Link href="/bookings">Leave a verified-booking review in My bookings →</Link></p>
  </div>
  {message&&<p ref={noticeRef} tabIndex={-1} role={messageIsError?'alert':'status'} className={messageIsError?'notice error':'notice'}>{message}</p>}
  {loadError&&<div role="alert" className="notice error"><p>{loadError}</p><button type="button" className="btn secondary" disabled={busy} onClick={()=>void refresh().catch(e=>setLoadError(e instanceof Error?e.message:'Retry failed'))}>Retry loading cases</button></div>}
  {loading?<p role="status" className="notice">Loading your support cases…</p>:
  !userId?<Link className="btn" href="/account?next=%2Fsupport%2Fcomplaints">Sign in</Link>:
  <div className="two-col">
   <section className="card">
    <h2>Raise a formal booking concern</h2>
    <form className="form" onSubmit={file}>
     <label>Related booking<select required value={booking} onChange={e=>setBooking(e.target.value)}>
      <option value="">Choose booking</option>
      {bookings.map(b=><option value={b.id} key={b.id}>Booking #{b.id.slice(0,8)} ({b.status.replace('_',' ')})</option>)}
     </select></label>
     <label>Concern type<select value={issueType} onChange={e=>setIssueType(e.target.value as ComplaintIssueKey)}>
      {COMPLAINT_ISSUE_OPTIONS.map(option=><option key={option.key} value={option.key}>{option.label}</option>)}
     </select></label>
     <p className="muted-note" style={{margin:'0 0 8px'}}>{selectedIssue.guidance}</p>
     <label>Describe the issue<textarea required minLength={30} maxLength={4000} value={statement} onChange={e=>setStatement(e.target.value)} placeholder="Describe what happened and when. Avoid entering bank details or passwords."/></label>
     <p className="muted-note">Case details are strictly restricted to the booking participants and authorised TrustFive reviewers; your identity is never posted publicly. For emergencies, contact emergency services immediately.</p>
     <button className="btn" disabled={busy} type="submit">{busy?'Submitting…':'Submit for review'}</button>
    </form>
   </section>
   <section>
    <h2>My cases</h2>
    {cases.length>0&&<div className="notification-filter-bar" role="group" aria-label="Filter support cases" style={{marginBottom:14}}>
     <button type="button" className={statusFilter==='all'?'job-filter-btn is-active':'job-filter-btn'} aria-pressed={statusFilter==='all'} onClick={()=>setStatusFilter('all')}>All <span className="job-filter-count">{cases.length}</span></button>
     <button type="button" className={statusFilter==='open'?'job-filter-btn is-active':'job-filter-btn'} aria-pressed={statusFilter==='open'} onClick={()=>setStatusFilter('open')}>Open <span className="job-filter-count">{openCount}</span></button>
     <button type="button" className={statusFilter==='resolved'?'job-filter-btn is-active':'job-filter-btn'} aria-pressed={statusFilter==='resolved'} onClick={()=>setStatusFilter('resolved')}>Resolved <span className="job-filter-count">{resolvedCount}</span></button>
    </div>}
    <div className="list">
     {visibleCases.length===0?<div className="card">{cases.length===0?'No cases involving your account.':'No cases match this filter.'}</div>:
     visibleCases.map(c=><article className="card" key={c.id}>
      <span className="pill">{c.status.replace('_',' ')}</span>
      <h3 style={{marginTop:9}}>{formatComplaintCategoryLabel(c.category,c.statement)} · #{c.id.slice(0,8)}</h3>
      <p className="muted-note">{new Date(c.created_at).toLocaleDateString('en-GB')} · {c.reporter_id===userId?'Filed by you':'You are the respondent'}</p>
      <p style={{marginTop:8}}>{c.statement}</p>
      {c.respondent_statement&&<div className="notice"><strong>Respondent reply:</strong><p>{c.respondent_statement}</p></div>}
      {c.resolution_reason&&<div className="notice"><strong>Human review decision:</strong><p>{c.resolution_reason}</p></div>}
      {c.respondent_id===userId&&!c.respondent_statement&&isOpenComplaintStatus(c.status)&&
       <p style={{marginTop:12}}><button type="button" className="btn secondary" onClick={()=>{setReplyTo(c.id);setResponse('');}}>Respond to complaint</button></p>}
      {replyTo===c.id&&<form onSubmit={respond} className="form" style={{marginTop:12}}>
       <label>Your response<textarea required minLength={20} maxLength={4000} value={response} onChange={e=>setResponse(e.target.value)}/></label>
       <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button className="btn" disabled={busy} type="submit">Submit response</button>
        <button type="button" className="btn secondary" disabled={busy} onClick={()=>setReplyTo('')}>Cancel</button>
       </div>
      </form>}
      {['substantiated','unsubstantiated'].includes(c.status)&&!appeals.some(a=>a.complaint_id===c.id)&&
       <p style={{marginTop:10}}><button type="button" className="btn secondary" onClick={()=>{setAppealFor(c.id);setAppealReason('');}}>Appeal decision</button></p>}
      {appealFor===c.id&&<form onSubmit={appeal} className="form" style={{marginTop:12}}>
       <label>Reason for appeal<textarea required minLength={30} maxLength={4000} value={appealReason} onChange={e=>setAppealReason(e.target.value)}/></label>
       <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button className="btn" disabled={busy} type="submit">Submit appeal</button>
        <button type="button" className="btn secondary" disabled={busy} onClick={()=>setAppealFor('')}>Cancel</button>
       </div>
      </form>}
      {appeals.filter(a=>a.complaint_id===c.id).map(a=><p key={a.id} className="muted-note" style={{marginTop:8}}>Your appeal: {a.status}{a.review_note?` — ${a.review_note}`:''}</p>)}
     </article>)}
    </div>
   </section>
  </div>}
 </main>;
}
