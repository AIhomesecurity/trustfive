'use client';

import {useEffect,useRef,useState} from 'react';
import {supabaseBrowser} from '../lib/supabase';
import {readablePostDate} from '../lib/social-discovery';
import {SOCIAL_REPORT_CATEGORIES,type SocialReportCategory} from '../lib/social-discussion';

type Report={id:string;category:string;explanation:string|null;created_at:string;post_body:string};
type Decision='hide'|'dismiss';
type CategoryFilter='all'|SocialReportCategory;

const CATEGORY_LABELS:Record<SocialReportCategory,string>={
 spam:'Spam',
 abuse:'Abusive content',
 privacy:'Private information',
 other:'Other concern',
};

export default function GroupPostModeration(){
 const [reports,setReports]=useState<Report[]|null>(null);
 const [categoryFilter,setCategoryFilter]=useState<CategoryFilter>('all');
 const [notice,setNotice]=useState('');
 const [noticeIsError,setNoticeIsError]=useState(false);
 const [busy,setBusy]=useState(false);
 const [decision,setDecision]=useState<{id:string;action:Decision}|null>(null);
 const cancelButton=useRef<HTMLButtonElement>(null);
 const status=useRef<HTMLParagraphElement>(null);
 const restoreFocus=useRef<{id:string;action:Decision}|null>(null);
 const actionButtons=useRef(new Map<string,HTMLButtonElement>());
 const focusStatus=useRef(false);
 const inFlight=useRef(false);
 const epoch=useRef(0);

 useEffect(()=>{
  const {data:{subscription}}=supabaseBrowser().auth.onAuthStateChange(event=>{
   if(event!=='SIGNED_OUT'&&event!=='SIGNED_IN'&&event!=='USER_UPDATED')return;
   epoch.current++;restoreFocus.current=null;focusStatus.current=false;
   setReports(null);setDecision(null);setNotice('');setNoticeIsError(false);setCategoryFilter('all');
  });
  return()=>{epoch.current++;subscription.unsubscribe();};
 },[]);

 useEffect(()=>{
  if(decision&&!busy)cancelButton.current?.focus();
  if(!decision&&restoreFocus.current){
   const {id,action}=restoreFocus.current;
   actionButtons.current.get(id+':'+action)?.focus();
   restoreFocus.current=null;
  }
 },[decision,busy]);

 useEffect(()=>{
  if(notice&&focusStatus.current){
   focusStatus.current=false;
   status.current?.focus();
  }
 },[notice]);

 async function run(action?:{id:string;action:Decision}){
  if(inFlight.current)return;
  inFlight.current=true;setBusy(true);setNotice('');setNoticeIsError(false);
  const version=epoch.current;
  let resolved=false;
  try{
   const client=supabaseBrowser();
   if(action){
    const {error}=await client.rpc('moderate_group_post_report',{p_report:action.id,p_action:action.action});
    if(error)throw error;
    resolved=true;
    if(version!==epoch.current)return;
    setDecision(null);
    setReports(items=>items?.filter(item=>item.id!==action.id)??null);
   }
   const {data,error}=await client.rpc('pending_group_post_reports');
   if(error)throw error;
   if(version!==epoch.current)return;
   setReports((data??[]) as Report[]);
   if(resolved){
    focusStatus.current=true;
    setNoticeIsError(false);
    setNotice(action?.action==='hide'?'Post hidden and decision recorded.':'Report dismissed and decision recorded.');
   }
  }catch{
   if(version!==epoch.current)return;
   // Preserve already-loaded queue items when a single moderation call fails so
   // moderators do not lose context across the remaining pending reports.
   if(!action&&!resolved)setReports(null);
   setDecision(null);
   focusStatus.current=true;
   setNoticeIsError(!resolved);
   setNotice(resolved?'Decision recorded. Reload the queue to see remaining reports.':
    'Could not load or update group reports. Check your access and try again.');
  }finally{
   inFlight.current=false;setBusy(false);
  }
 }

 const filteredReports=reports
  ? (categoryFilter==='all'?reports:reports.filter(item=>item.category===categoryFilter))
  : null;

 return <section className="card" aria-labelledby="group-reports-title" style={{marginTop:20}}>
  <h2 id="group-reports-title">Group post reports</h2>
  <p className="muted-note">
   Authorised moderators review member-submitted reports from all groups. Hiding removes the post from group members while recording an audit event; dismissing keeps the post visible.
  </p>
  <div className="social-hub-shortcuts">
   <button type="button" className="btn secondary" disabled={busy} onClick={()=>void run()}>
    {busy?'Working…':reports?'Refresh group reports':'Load group reports'}
   </button>
   {reports&&reports.length>0&&<label style={{display:'inline-flex',alignItems:'center',gap:8,fontSize:14,fontWeight:700}}>
    Category
    <select aria-label="Filter group reports by category" value={categoryFilter} disabled={busy}
     onChange={event=>{setCategoryFilter(event.target.value as CategoryFilter);setDecision(null);}}>
     <option value="all">All categories ({reports.length})</option>
     {SOCIAL_REPORT_CATEGORIES.map(cat=>{
      const count=reports.filter(item=>item.category===cat).length;
      return <option key={cat} value={cat}>{CATEGORY_LABELS[cat]} ({count})</option>;
     })}
    </select>
   </label>}
  </div>
  {notice&&<p ref={status} role={noticeIsError?'alert':'status'} tabIndex={-1} className={noticeIsError?'notice error':'notice'}>{notice}</p>}
  {reports?.length===0&&<p>No pending group post reports.</p>}
  {reports&&reports.length>0&&filteredReports&&filteredReports.length===0&&<p className="muted-note">No pending reports match the selected category.</p>}
  {filteredReports?.map(report=><article className="notice" key={report.id}>
   <div className="social-post-meta">
    <h3 style={{margin:0}}>{report.category} report</h3>
    <span className="pill">{CATEGORY_LABELS[report.category as SocialReportCategory]??report.category}</span>
   </div>
   <p className="muted-note">{readablePostDate(report.created_at)}</p>
   <blockquote style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{report.post_body}</blockquote>
   {report.explanation&&<p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>Reporter details: {report.explanation}</p>}
   {decision?.id===report.id?<div role="group" aria-label="Confirm moderation decision" className="social-hub-shortcuts" onKeyDown={event=>{
     if(event.key==='Escape'&&!busy){event.preventDefault();restoreFocus.current=decision;setDecision(null);}
    }}>
    <button type="button" className="btn" disabled={busy} onClick={()=>void run(decision)}>
     {decision.action==='hide'?'Confirm hide post':'Confirm dismiss report'}
    </button>
    <button ref={cancelButton} type="button" className="btn secondary" disabled={busy} onClick={()=>{restoreFocus.current=decision;setDecision(null);}}>Cancel</button>
   </div>:<div className="social-hub-shortcuts">
    <button type="button" className="btn secondary" disabled={busy} ref={button=>{const key=report.id+':hide';if(button)actionButtons.current.set(key,button);else actionButtons.current.delete(key);}} onClick={()=>setDecision({id:report.id,action:'hide'})}>Hide post</button>
    <button type="button" className="btn secondary" disabled={busy} ref={button=>{const key=report.id+':dismiss';if(button)actionButtons.current.set(key,button);else actionButtons.current.delete(key);}} onClick={()=>setDecision({id:report.id,action:'dismiss'})}>Dismiss report</button>
   </div>}
  </article>)}
 </section>;
}
