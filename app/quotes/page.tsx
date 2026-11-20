'use client';
import {FormEvent,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import {quoteMessagesHref,bookingHistoryHref,bookingScheduleHref} from '../../lib/workflow-links';
import {canPrepareProfessionalQuote,professionalQuoteStats} from '../../lib/professional-quote-guard';

type Lead={job_id:string;title:string;description:string;budget_pence:number|null;trade_name:string;area_name:string;allocation_id:string;created_at:string};
type Quote={quote_id:string;job_id:string;job_title:string;amount_pence:number;message:string;status:string;created_at:string};
type Booking={id:string;quote_id:string;status:string};

const money=(pence:number)=>'£'+(pence/100).toFixed(2);
export default function Quotes(){
 const [userId,setUserId]=useState('');
 const [leads,setLeads]=useState<Lead[]>([]);
 const [quotes,setQuotes]=useState<Quote[]>([]);
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [chosen,setChosen]=useState<Lead|null>(null);
 const [amount,setAmount]=useState('');
 const [message,setMessage]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [filter,setFilter]=useState('');
 const [view,setView]=useState<'all'|'unquoted'>('unquoted');

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
   setLeads(l.data||[]);setQuotes(q.data||[]);setBookings(b.data||[]);
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

 const stats=professionalQuoteStats(leads,quotes);
 const filtered=useMemo(()=>{
  const search=filter.trim().toLowerCase();
  return leads.filter(lead=>(view==='all'||!quotes.some(q=>q.job_id===lead.job_id))&&
   (!search||[lead.title,lead.description,lead.trade_name,lead.area_name].some(field=>field.toLowerCase().includes(search))));
 },[leads,quotes,filter,view]);
 const existingForChosen=chosen?quotes.find(q=>q.job_id===chosen.job_id):undefined;

 async function submit(e:FormEvent){
  e.preventDefault();
  if(!chosen||busy)return;
  if(!canPrepareProfessionalQuote(chosen,leads,quotes)){
   setChosen(null);setNotice('This opportunity is no longer available for a new quote. Refresh your leads.');return;
  }
  setBusy(true);setNotice('');
  try{
   const pence=Math.round(Number(amount)*100);
   if(!Number.isSafeInteger(pence)||pence<100||pence>1000000000)throw Error('Quote must be between £1 and £10 million');
   if(message.trim().length<10)throw Error('Describe the scope of work in at least 10 non-whitespace characters');
   const {error}=await supabaseBrowser().from('job_quotes').insert({
    job_id:chosen.job_id,professional_allocation_id:chosen.allocation_id,
    professional_id:userId,amount_pence:pence,message:message.trim(),status:'pending'
   });
   if(error)throw error;
   setChosen(null);setAmount('');setMessage('');
   await refresh();setNotice('Quote submitted to the customer. No payment has been collected.');
  }catch(e){setNotice(e instanceof Error?e.message:'Quote failed');}
  finally{setBusy(false);}
 }
 async function ready(id:string){
  if(busy)return;
  setBusy(true);setNotice('');
  try{
   const {error}=await supabaseBrowser().rpc('mark_job_ready_for_confirmation',{p_booking:id});
   if(error)throw error;
   await refresh();
   setNotice('The customer can now confirm completion in their booking. Automatic email/push notifications are not enabled yet.');
  }catch(e){setNotice(e instanceof Error?e.message:'Unable to update booking');}
  finally{setBusy(false);}
 }
 return <main className="container">
  <div className="page-heading"><span className="eyebrow">Approved professional workspace</span>
   <h1>Leads, quotes and work</h1>
   <p className="subtle">Only active, independently approved professionals can access matching customer job requests for their verified service areas.</p>
  </div>
  {notice&&<p role="status" className="notice">{notice}</p>}
  {loading?<p role="status" className="notice">Checking your professional account and leads…</p>:
   !userId?<Link className="btn" href="/account?next=%2Fquotes">Sign in to access leads</Link>:
   <>
    <div className="professional-overview" aria-label="Your professional activity">
     <div className="card"><strong>{stats.available}</strong><span>New matching leads</span></div>
     <div className="card"><strong>{stats.submitted}</strong><span>Submitted quotes</span></div>
     <div className="card"><strong>{stats.awaiting}</strong><span>Awaiting customer response</span></div>
    </div>
    <div className="professional-lead-layout">
     <section aria-labelledby="lead-list-heading">
      <div className="professional-section-heading"><h2 id="lead-list-heading">Matching customer jobs</h2>
       <button type="button" className="btn secondary" disabled={refreshing||busy} onClick={()=>void refresh().catch(e=>setNotice(e instanceof Error?e.message:'Unable to refresh leads'))}>{refreshing?'Refreshing…':'Refresh leads'}</button>
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
           <button type="button" className="btn" disabled={busy} onClick={()=>{setChosen(job);setNotice('');}}>Prepare a quote</button>}
         </div>
        </article>;
       })}
      </div>
     </section>
     <section aria-labelledby="submitted-quotes-heading">
      {chosen&&<div className="card" style={{marginBottom:22}}>
       <h2>Quote for: {chosen.title}</h2>
       <p className="muted-note">{chosen.trade_name} · {chosen.area_name}</p>
       {existingForChosen?<div className="notice">A quote has already been submitted for this job. <Link href={quoteMessagesHref(existingForChosen.quote_id)}>Open conversation</Link>.</div>:
       <form className="form" onSubmit={submit}>
        <label>Your quote (£)<input type="number" min="1" max="10000000" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
        <label>Message and scope of work<textarea minLength={10} maxLength={3000} required value={message} onChange={e=>setMessage(e.target.value)} placeholder="Describe materials, timing, exclusions and assumptions"/></label>
        <p className="muted-note">Make sure the price and scope are accurate. This sends a quote, not a payment request.</p>
        <div className="professional-lead-actions"><button type="submit" disabled={busy||refreshing} className="btn">{busy?'Sending…':'Send quote'}</button>
         <button type="button" disabled={busy} className="btn secondary" onClick={()=>setChosen(null)}>Cancel</button>
        </div>
       </form>}
      </div>}
      <div className="professional-section-heading"><h2 id="submitted-quotes-heading">Your submitted quotes</h2><Link href="/bookings">View bookings →</Link></div>
      <div className="list">
       {quotes.length===0?<div className="card"><h3>No quotes submitted</h3><p>Once you send a qualifying customer quote, track its status here and message that customer.</p></div>:
       quotes.map(q=><article className="card" key={q.quote_id}>
        <span className="pill">{q.status}</span>
        <h3 style={{marginTop:10}}>{q.job_title}</h3>
        <p><strong>{money(q.amount_pence)}</strong></p><p style={{whiteSpace:'pre-wrap'}}>{q.message}</p>
        <p style={{marginTop:12}}><Link href={quoteMessagesHref(q.quote_id)}>Open exact message thread →</Link></p>
        {bookings.filter(b=>b.quote_id===q.quote_id).map(b=><div className="professional-booking-actions" key={b.id}>
         <p><strong>Booking status:</strong> {b.status}</p>
         <Link href={bookingHistoryHref(b.id)}>View booking</Link><Link href={bookingScheduleHref(b.id)}>Appointments</Link>
         {b.status==='booked'&&<button type="button" className="btn secondary" disabled={busy} onClick={()=>void ready(b.id)}>{busy?'Saving…':'Mark work ready'}</button>}
        </div>)}
       </article>)}
      </div>
     </section>
    </div>
   </>}
 </main>;
}
