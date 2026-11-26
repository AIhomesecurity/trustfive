'use client';
import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import {quoteMessagesHref,bookingHistoryHref,bookingScheduleHref} from '../../lib/workflow-links';
import {canPrepareProfessionalQuote,professionalQuoteStats} from '../../lib/professional-quote-guard';
import {createSingleFlightLock,executeBookingAction} from '../../lib/booking-lifecycle';
import {validateQuoteAvailability} from '../../lib/quote-comparison';
import {buildPrintableQuoteDocument,buildQuotesAccountingCsv} from '../../lib/tradesman-utilities';

type Lead={job_id:string;title:string;description:string;budget_pence:number|null;trade_name:string;area_name:string;allocation_id:string;created_at:string};
type Quote={quote_id:string;job_id:string;job_title:string;amount_pence:number;message:string;availability_note?:string|null;status:string;created_at:string};
type Booking={id:string;quote_id:string;status:string};

const money=(pence:number)=>'£'+(pence/100).toFixed(2);
export default function Quotes(){
 const [userId,setUserId]=useState('');
 const [leads,setLeads]=useState<Lead[]>([]);
 const [quotes,setQuotes]=useState<Quote[]>([]);
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [chosen,setChosen]=useState<Lead|null>(null);
 const quoteHeading=useRef<HTMLHeadingElement>(null);
 const [amount,setAmount]=useState('');
 const [availability,setAvailability]=useState('');
 const [message,setMessage]=useState('');
 const [notice,setNotice]=useState('');
 const [quoteError,setQuoteError]=useState('');
 const quoteErrorRef=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(quoteError)quoteErrorRef.current?.focus();},[quoteError]);
 const [busy,setBusy]=useState(false);
 const [requiresReload,setRequiresReload]=useState(false);
 const mutationLock=useRef(createSingleFlightLock());
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [filter,setFilter]=useState('');
 const [view,setView]=useState<'all'|'unquoted'>('unquoted');
 const [confirmWithdrawId,setConfirmWithdrawId]=useState<string|null>(null);

 async function refresh(){
  setRefreshing(true);
  try{
   const s=supabaseBrowser();
   const [l,q,b]=await Promise.all([
    s.rpc('open_jobs_for_professional'),
    s.rpc('professional_quotes'),
    s.from('job_bookings').select('id,quote_id,status')
   ]);
   if(l.error)throw l.error;
   if(q.error)throw q.error;
   if(b.error)throw b.error;
   setLeads((l.data||[]) as Lead[]);
   setQuotes((q.data||[]) as Quote[]);
   setBookings((b.data||[]) as Booking[]);
   setRequiresReload(false);
  }catch(error){
   setRequiresReload(true);
   throw error;
  }finally{setRefreshing(false);}
 }
 useEffect(()=>{
  let mounted=true;
  (async()=>{
   try{
    const {data:{user},error}=await supabaseBrowser().auth.getUser();
    if(error)throw error;
    if(!mounted)return;
    if(!user){setNotice('Sign in as a professional to access eligible leads.');return;}
    setUserId(user.id);await refresh();
   }catch(e){if(mounted)setNotice(e instanceof Error?e.message:'Could not load opportunities');}
   finally{if(mounted)setLoading(false);}
  })();
  return()=>{mounted=false;};
 },[]);

 useEffect(()=>{
  if(chosen)quoteHeading.current?.focus();
 },[chosen]);

 function chooseLead(lead:Lead|null){
  if(chosen?.job_id!==lead?.job_id||chosen?.allocation_id!==lead?.allocation_id){
   setAmount('');setAvailability('');setMessage('');setQuoteError('');
  }
  setChosen(lead);
 }

 const stats=professionalQuoteStats(leads,quotes);
 const filtered=useMemo(()=>{
  const search=filter.trim().toLowerCase();
  return leads.filter(lead=>(view==='all'||!quotes.some(q=>q.job_id===lead.job_id))&&
   (!search||[lead.title,lead.description,lead.trade_name,lead.area_name].some(field=>field.toLowerCase().includes(search))));
 },[leads,quotes,filter,view]);
 const existingForChosen=chosen?quotes.find(q=>q.job_id===chosen.job_id):undefined;

 const mutationsDisabled=busy||refreshing||requiresReload;

 async function runMutation(options:Parameters<typeof executeBookingAction>[0],onError?:(message:string)=>void){
  if(mutationsDisabled)return;
  await mutationLock.current.run(async()=>{
   setBusy(true);setNotice('');
   try{
    const result=await executeBookingAction(options);
    if(result.outcome==='committed_refresh_failed')setRequiresReload(true);
    if(result.outcome==='rpc_error'&&onError)onError(result.message);
    else setNotice(result.message);
   }finally{setBusy(false);}
  });
 }

 async function reload(){
  await mutationLock.current.run(async()=>{
   try{await refresh();if(requiresReload)setNotice('Leads and quotes refreshed.');}
   catch(e){setNotice(e instanceof Error?e.message:'Unable to refresh leads');}
  });
 }

 async function submit(e:FormEvent){
  e.preventDefault();
  if(!chosen||mutationsDisabled)return;
  if(!canPrepareProfessionalQuote(chosen,leads,quotes)){
   chooseLead(null);setNotice('This opportunity is no longer available for a new quote. Refresh your leads.');return;
  }
  setQuoteError('');
  const availError=validateQuoteAvailability(availability);
  if(availError){setQuoteError(availError);return;}
  const pence=Math.round(Number(amount)*100);
  if(!Number.isSafeInteger(pence)||pence<100||pence>1000000000){
   setQuoteError('Quote must be between £1 and £10 million');return;
  }
  if(message.trim().length<10){
   setQuoteError('Describe the scope of work in at least 10 non-whitespace characters');return;
  }
  await runMutation({
   runRpc:async()=>supabaseBrowser().from('job_quotes').insert({
    job_id:chosen.job_id,
    professional_allocation_id:chosen.allocation_id,
    professional_id:userId,
    amount_pence:pence,
    message:message.trim(),
    availability_note:availability.trim()||null,
    status:'pending'
   }),
   onCommittedLocalUpdate:()=>chooseLead(null),
   runRefresh:refresh,
   successMessage:'Quote submitted to the customer. No payment has been collected.',
   refreshFailedMessage:'Quote submitted to the customer. Refresh your leads to see it before making another change.',
   fallbackErrorMessage:'Unable to submit quote',
  },setQuoteError);
 }

 async function withdraw(quoteId:string){
  await runMutation({
   runRpc:async()=>supabaseBrowser().rpc('withdraw_job_quote',{p_quote:quoteId}),
   onCommittedLocalUpdate:()=>setConfirmWithdrawId(null),
   runRefresh:refresh,
   successMessage:'Pending quote withdrawn.',
   refreshFailedMessage:'Quote withdrawn. Refresh your leads to see the latest status.',
   fallbackErrorMessage:'Unable to withdraw quote',
  });
 }

 async function ready(id:string){
  await runMutation({
   runRpc:async()=>supabaseBrowser().rpc('mark_job_ready_for_confirmation',{p_booking:id}),
   onCommittedLocalUpdate:()=>{},
   runRefresh:refresh,
   successMessage:'The customer can now confirm completion in their booking. Automatic email/push notifications are not enabled yet.',
   refreshFailedMessage:'Work marked ready for customer confirmation. Refresh your leads to see the latest status.',
   fallbackErrorMessage:'Unable to update booking',
  });
 }

 return <main className="container">
  <div className="page-heading"><span className="eyebrow">Approved professional workspace</span>
   <h1>Leads, quotes and work</h1>
   <p className="subtle">Only active, independently approved professionals can access matching customer job requests for their verified service areas.</p>
  </div>
  {notice&&<p role="status" className="notice">{notice}</p>}
  {loading?<p role="status" className="notice">Checking your professional account and leads…</p>:
   !userId?<Link className="btn" href="/account?next=%2Fquotes">Sign in to access leads</Link>:
   requiresReload?<section className="card" aria-labelledby="professional-reload-title">
    <h2 id="professional-reload-title">Leads and quotes need to reload</h2>
    <p>Reload to check current lead eligibility and quote or booking status.</p>
    <button type="button" className="btn secondary" disabled={refreshing||busy} onClick={()=>void reload()}>
     {refreshing?'Refreshing…':'Retry loading leads and quotes'}
    </button>
   </section>:
   <>
    <div className="professional-overview" aria-label="Your professional activity">
     <div className="card"><strong>{stats.available}</strong><span>New matching leads</span></div>
     <div className="card"><strong>{stats.submitted}</strong><span>Submitted quotes</span></div>
     <div className="card"><strong>{stats.awaiting}</strong><span>Awaiting customer response</span></div>
    </div>
    <div className="professional-lead-layout">
     <section aria-labelledby="lead-list-heading">
      <div className="professional-section-heading"><h2 id="lead-list-heading">Matching customer jobs</h2>
       <button type="button" className="btn secondary" disabled={refreshing||busy} onClick={()=>void reload()}>{refreshing?'Refreshing…':'Refresh leads'}</button>
      </div>
      <div className="professional-lead-filters">
       <label>Find a job<input type="search" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Trade, area or job description"/></label>
       <label>Show<select value={view} onChange={e=>setView(e.target.value as 'all'|'unquoted')}>
        <option value="unquoted">Not yet quoted</option><option value="all">All matching jobs</option>
       </select></label>
      </div>
      <div className="list" aria-busy={refreshing}>
       {filtered.length===0?<div className="card"><h3>No matching open jobs</h3>
        <p>{leads.length===0?'Jobs appear here only while you hold an active, independently approved five-place allocation with verified geographic coverage.':'Try another search or include jobs you have already quoted.'}</p>
        <p style={{marginTop:12}}><Link href="/professional/apply">Check professional application →</Link></p>
       </div>:
       filtered.map(job=>{
        const existing=quotes.find(q=>q.job_id===job.job_id);
        return <article className="card" key={job.job_id}>
         <span className="pill">{job.trade_name} · {job.area_name}</span>
         <h3 style={{marginTop:12}}>{job.title}</h3>
         <p style={{whiteSpace:'pre-wrap'}}>{job.description}</p>
         {job.budget_pence!==null&&<p style={{marginTop:10}}>Customer estimate: <strong>{money(job.budget_pence)}</strong></p>}
         <div className="professional-lead-actions">
          {existing?<><span className="muted-note">Your {existing.status} quote is already recorded.</span>
            <Link className="btn secondary" href={quoteMessagesHref(existing.quote_id)}>Open conversation</Link></>:
           <button type="button" className="btn" disabled={mutationsDisabled} onClick={()=>{chooseLead(job);setNotice('');}}>Prepare a quote</button>}
         </div>
        </article>;
       })}
      </div>
     </section>
     <section aria-labelledby="submitted-quotes-heading">
      {chosen&&<div className="card" style={{marginBottom:22}}>
       <h2 ref={quoteHeading} tabIndex={-1}>Quote for: {chosen.title}</h2>
       <p className="muted-note">{chosen.trade_name} · {chosen.area_name}</p>
       {existingForChosen?<div className="notice">A quote has already been submitted for this job. <Link href={quoteMessagesHref(existingForChosen.quote_id)}>Open conversation</Link>.</div>:
       <form className="form" onSubmit={submit}>
        <label>Your quote (£)<input type="number" min="1" max="10000000" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
        <label>Earliest availability and timeframe (optional)<input maxLength={240} value={availability} onChange={e=>setAvailability(e.target.value)} placeholder="e.g. Available from Tuesday morning; approx. 1 day"/></label>
        <label>Message and scope of work<textarea minLength={10} maxLength={3000} required value={message} onChange={e=>setMessage(e.target.value)} placeholder="Describe materials, timing, exclusions and assumptions"/></label>
        <p className="muted-note">Make sure the price, availability and scope are accurate. This sends a quote, not a payment request.</p>
        {quoteError&&<p ref={quoteErrorRef} tabIndex={-1} className="notice error" role="alert">{quoteError}</p>}
        <div className="professional-lead-actions"><button type="submit" disabled={mutationsDisabled} className="btn">{busy?'Sending…':'Send quote'}</button>
         <button type="button" disabled={busy} className="btn secondary" onClick={()=>chooseLead(null)}>Cancel</button>
        </div>
       </form>}
      </div>}
      <div className="professional-section-heading"><h2 id="submitted-quotes-heading">Your submitted quotes</h2><Link href="/bookings">View bookings →</Link></div>
      {quotes.length>0&&<div className="tf-util-bar">
       <button type="button" className="btn secondary" onClick={()=>{
        const csv=buildQuotesAccountingCsv(quotes);
        const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
        const url=URL.createObjectURL(blob);
        const link=document.createElement('a');
        link.href=url;link.download='trustfive-quotes-export.csv';
        document.body.appendChild(link);link.click();link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
        setNotice('Quotes exported to CSV for bookkeeping.');
       }}>Export quotes CSV (HMRC / bookkeeping)</button>
      </div>}
      <div className="list">
       {quotes.length===0?<div className="card"><h3>No quotes submitted</h3><p>Once you send a qualifying customer quote, track its status here and message that customer.</p></div>:
       quotes.map(q=><article className="card" key={q.quote_id}>
        <span className="pill">{q.status}</span>
        <h3 style={{marginTop:10}}>{q.job_title}</h3>
        <p><strong>{money(q.amount_pence)}</strong></p>
        {q.availability_note&&<p className="muted-note" style={{marginTop:4}}><strong>Availability:</strong> {q.availability_note}</p>}
        <p style={{whiteSpace:'pre-wrap',marginTop:6}}>{q.message}</p>
        <div className="tf-util-bar">
         <Link href={quoteMessagesHref(q.quote_id)}>Open exact message thread →</Link>
         <button type="button" className="btn secondary" onClick={()=>{
          const html=buildPrintableQuoteDocument(q);
          const blob=new Blob([html],{type:'text/html;charset=utf-8'});
          const url=URL.createObjectURL(blob);
          const link=document.createElement('a');
          link.href=url;link.download=`trustfive-quote-${q.quote_id.slice(0,8)}.html`;
          document.body.appendChild(link);link.click();link.remove();
          setTimeout(()=>URL.revokeObjectURL(url),1000);
         }}>Download printable quote sheet</button>
        </div>
        {q.status==='pending'&&(
         confirmWithdrawId===q.quote_id?
         <div className="notice" style={{marginTop:10}}>
          <p>Withdraw this pending quote? The customer will no longer be able to accept it.</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
           <button type="button" className="btn secondary" disabled={mutationsDisabled} onClick={()=>void withdraw(q.quote_id)}>Confirm withdrawal</button>
           <button type="button" className="btn secondary" disabled={busy} onClick={()=>setConfirmWithdrawId(null)}>Keep quote</button>
          </div>
         </div>:
         <p style={{marginTop:8}}><button type="button" className="btn secondary" disabled={mutationsDisabled} onClick={()=>setConfirmWithdrawId(q.quote_id)}>Withdraw pending quote</button></p>
        )}
        {bookings.filter(b=>b.quote_id===q.quote_id).map(b=><div className="professional-booking-actions" key={b.id}>
         <p><strong>Booking status:</strong> {b.status}</p>
         <Link href={bookingHistoryHref(b.id)}>View booking</Link><Link href={bookingScheduleHref(b.id)}>Appointments</Link>
         {b.status==='booked'&&<button type="button" className="btn secondary" disabled={mutationsDisabled} onClick={()=>void ready(b.id)}>{busy?'Saving…':'Mark work ready'}</button>}
        </div>)}
       </article>)}
      </div>
     </section>
    </div>
   </>}
 </main>;
}
