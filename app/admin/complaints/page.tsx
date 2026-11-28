'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../../lib/supabase';
import {
  filterComplaintsByStatus,
  formatComplaintCategoryLabel,
  isOpenComplaintStatus,
  validateAdminDecisionNote,
  type ComplaintStatusFilter,
} from '../../../lib/booking-complaints';

type Complaint={id:string;category:string;statement:string;respondent_statement:string|null;resolution_reason?:string|null;status:string;created_at:string};
type Appeal={id:string;complaint_id:string;reason:string;status:string;review_note?:string|null};
type DecisionDraft={outcome:'unsubstantiated'|'substantiated';reason:string};

export default function AdminComplaints(){
 const [admin,setAdmin]=useState(false);
 const [loading,setLoading]=useState(true);
 const [cases,setCases]=useState<Complaint[]>([]);
 const [appeals,setAppeals]=useState<Appeal[]>([]);
 const [filter,setFilter]=useState<ComplaintStatusFilter>('open');
 const [decisionDrafts,setDecisionDrafts]=useState<Record<string,DecisionDraft>>({});
 const [appealNotes,setAppealNotes]=useState<Record<string,string>>({});
 const [pendingConfirmCaseId,setPendingConfirmCaseId]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [messageIsError,setMessageIsError]=useState(false);
 const inFlight=useRef(false);
 const noticeRef=useRef<HTMLParagraphElement>(null);

 useEffect(()=>{
  if(message&&messageIsError)noticeRef.current?.focus();
 },[message,messageIsError]);

 async function load(){
  const s=supabaseBrowser();
  const [c,a]=await Promise.all([
   s.from('booking_complaints').select('id,category,statement,respondent_statement,resolution_reason,status,created_at').order('created_at',{ascending:false}),
   s.from('complaint_appeals').select('id,complaint_id,reason,status,review_note').order('created_at',{ascending:false})
  ]);
  if(c.error)throw c.error;
  if(a.error)throw a.error;
  setCases((c.data||[]) as Complaint[]);
  setAppeals((a.data||[]) as Appeal[]);
 }

 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const {data,error}=await supabaseBrowser().rpc('is_trustfive_admin');
    if(error)throw error;
    if(!active)return;
    setAdmin(Boolean(data));
    if(data)await load();
   }catch(e){
    if(active){
     setMessageIsError(true);
     setMessage(e instanceof Error?e.message:'Unable to verify admin privileges');
    }
   }finally{
    if(active)setLoading(false);
   }
  })();
  return()=>{active=false;};
 },[]);

 function getCaseDraft(id:string):DecisionDraft{
  return decisionDrafts[id]??{outcome:'unsubstantiated',reason:''};
 }

 function updateCaseDraft(id:string,patch:Partial<DecisionDraft>){
  setDecisionDrafts(prev=>({
   ...prev,
   [id]:{...(prev[id]??{outcome:'unsubstantiated',reason:''}),...patch},
  }));
 }

 function requestResolveConfirm(id:string){
  const draft=getCaseDraft(id);
  const validationError=validateAdminDecisionNote(draft.reason);
  if(validationError){
   setMessageIsError(true);
   setMessage(validationError);
   return;
  }
  setMessage('');
  setMessageIsError(false);
  setPendingConfirmCaseId(id);
 }

 async function resolve(id:string){
  if(busy||inFlight.current)return;
  const draft=getCaseDraft(id);
  const validationError=validateAdminDecisionNote(draft.reason);
  if(validationError){
   setMessageIsError(true);
   setMessage(validationError);
   return;
  }
  inFlight.current=true;setBusy(true);setMessage('');setMessageIsError(false);
  try{
   const {error}=await supabaseBrowser().rpc('resolve_booking_complaint',{
    p_complaint:id,p_outcome:draft.outcome,p_reason:draft.reason.trim()
   });
   if(error)throw error;
   await load();
   setPendingConfirmCaseId(null);
   setDecisionDrafts(prev=>{
    const next={...prev};
    delete next[id];
    return next;
   });
   setMessageIsError(false);
   setMessage('Evidence-based complaint decision recorded. A separate, fair decision is required before any professional slot removal.');
  }catch(e){
   setMessageIsError(true);
   setMessage(e instanceof Error?e.message:'Unable to resolve');
  }finally{inFlight.current=false;setBusy(false);}
 }

 async function resolveAppeal(id:string,upheld:boolean){
  if(busy||inFlight.current)return;
  const note=(appealNotes[id]??'').trim();
  const validationError=validateAdminDecisionNote(note);
  if(validationError){
   setMessageIsError(true);
   setMessage('Explain the appeal decision with at least 30 characters.');
   return;
  }
  inFlight.current=true;setBusy(true);setMessage('');setMessageIsError(false);
  try{
   const {error}=await supabaseBrowser().rpc('resolve_complaint_appeal',{
    p_appeal:id,p_upheld:upheld,p_reason:note
   });
   if(error)throw error;
   await load();
   setAppealNotes(prev=>{
    const next={...prev};
    delete next[id];
    return next;
   });
   setMessageIsError(false);
   setMessage('Appeal decision recorded for the applicant.');
  }catch(e){
   setMessageIsError(true);
   setMessage(e instanceof Error?e.message:'Unable to resolve appeal');
  }finally{inFlight.current=false;setBusy(false);}
 }

 const openCount=useMemo(()=>cases.filter(c=>isOpenComplaintStatus(c.status)).length,[cases]);
 const resolvedCount=cases.length-openCount;
 const visibleCases=useMemo(()=>filterComplaintsByStatus(cases,filter),[cases,filter]);

 return <main className="container">
  <div className="page-heading">
   <span className="eyebrow">Restricted dispute resolution</span>
   <h1>Complaints and appeals review</h1>
   <p className="subtle"><Link href="/admin">← Admin overview</Link></p>
  </div>
  {message&&<p ref={noticeRef} tabIndex={-1} role={messageIsError?'alert':'status'} className={messageIsError?'notice error':'notice'}>{message}</p>}
  {loading&&<p role="status">Checking access…</p>}
  {!loading&&!admin&&<p role="alert" className="notice error">Admin access required.</p>}
  {admin&&<>
   <section className="section">
    <h2>Reported cases</h2>
    <p className="subtle">Consider evidence from both parties. Complaints never automatically remove an approved professional.</p>
    <div className="notification-filter-bar" role="group" aria-label="Filter complaint queue" style={{marginBottom:16}}>
     <button type="button" className={filter==='open'?'job-filter-btn is-active':'job-filter-btn'} aria-pressed={filter==='open'} onClick={()=>setFilter('open')}>Open <span className="job-filter-count">{openCount}</span></button>
     <button type="button" className={filter==='resolved'?'job-filter-btn is-active':'job-filter-btn'} aria-pressed={filter==='resolved'} onClick={()=>setFilter('resolved')}>Resolved <span className="job-filter-count">{resolvedCount}</span></button>
     <button type="button" className={filter==='all'?'job-filter-btn is-active':'job-filter-btn'} aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>All <span className="job-filter-count">{cases.length}</span></button>
    </div>
    <div className="list">
     {visibleCases.length===0?<div className="card">No booking complaints in this view.</div>:
     visibleCases.map(c=>{
      const draft=getCaseDraft(c.id);
      const isConfirming=pendingConfirmCaseId===c.id;
      return <article className="card" id={'complaint-case-'+c.id} key={c.id}>
       <span className="pill">{c.status}</span>
       <h3 style={{marginTop:10}}>{formatComplaintCategoryLabel(c.category,c.statement)} · #{c.id.slice(0,8)}</h3>
       <p>{c.statement}</p>
       <div className="notice"><strong>Respondent:</strong><p>{c.respondent_statement||'No response provided yet'}</p></div>
       {c.resolution_reason&&<div className="notice"><strong>Recorded decision:</strong><p>{c.resolution_reason}</p></div>}
       {isOpenComplaintStatus(c.status)&&<div className="form">
        <label>Decision
         <select value={draft.outcome} onChange={e=>updateCaseDraft(c.id,{outcome:e.target.value as 'unsubstantiated'|'substantiated'})}>
          <option value="unsubstantiated">Not substantiated</option>
          <option value="substantiated">Substantiated</option>
         </select>
        </label>
        <label>Document findings and evidence
         <textarea required minLength={30} maxLength={4000} value={draft.reason} onChange={e=>updateCaseDraft(c.id,{reason:e.target.value})} placeholder="Evidence reviewed, findings, and why this outcome is fair…"/>
        </label>
        {isConfirming?
         <div className="notice" role="group" aria-label={'Confirm decision for case '+c.id.slice(0,8)} onKeyDown={e=>{if(e.key==='Escape'&&!busy){e.preventDefault();setPendingConfirmCaseId(null);}}}>
          <p>Confirm recording <strong>{draft.outcome==='substantiated'?'Substantiated':'Not substantiated'}</strong> for case #{c.id.slice(0,8)}? This does not auto-suspend any professional.</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
           <button type="button" className="btn" disabled={busy} onClick={()=>void resolve(c.id)}>Confirm human decision</button>
           <button type="button" className="btn secondary" disabled={busy} onClick={()=>setPendingConfirmCaseId(null)}>Cancel</button>
          </div>
         </div>:
         <button type="button" className="btn" disabled={busy} onClick={()=>requestResolveConfirm(c.id)}>Record human decision</button>}
       </div>}
      </article>;
     })}
    </div>
   </section>
   <section className="section">
    <h2>Appeals</h2>
    <div className="list">
     {appeals.length===0?<div className="card">No appeals.</div>:
     appeals.map(a=><article className="card" id={'appeal-case-'+a.id} key={a.id}>
      <span className="pill">{a.status}</span>
      <p style={{marginTop:10}}>{a.reason}</p>
      {a.review_note&&<div className="notice"><strong>Appeal decision:</strong><p>{a.review_note}</p></div>}
      {a.status==='pending'&&<div className="form">
       <label>Explain appeal review
        <textarea required minLength={30} maxLength={4000} value={appealNotes[a.id]??''} onChange={e=>setAppealNotes(prev=>({...prev,[a.id]:e.target.value}))}/>
       </label>
       <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        <button type="button" className="btn" disabled={busy} onClick={()=>void resolveAppeal(a.id,true)}>Uphold appeal</button>
        <button type="button" className="btn secondary" disabled={busy} onClick={()=>void resolveAppeal(a.id,false)}>Deny appeal</button>
       </div>
      </div>}
     </article>)}
    </div>
   </section>
  </>}
 </main>;
}
