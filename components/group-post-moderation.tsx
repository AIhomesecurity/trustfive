'use client';

import {useEffect,useRef,useState} from 'react';
import {supabaseBrowser} from '../lib/supabase';
import {readablePostDate} from '../lib/social-discovery';

type Report={id:string;category:string;explanation:string|null;created_at:string;post_body:string};
type Decision='hide'|'dismiss';

export default function GroupPostModeration(){
 const [reports,setReports]=useState<Report[]|null>(null);
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [decision,setDecision]=useState<{id:string;action:Decision}|null>(null);
 const inFlight=useRef(false);
 const epoch=useRef(0);

 useEffect(()=>{
  const {data:{subscription}}=supabaseBrowser().auth.onAuthStateChange(event=>{
   if(event!=='SIGNED_OUT'&&event!=='SIGNED_IN'&&event!=='USER_UPDATED')return;
   epoch.current++;setReports(null);setDecision(null);setNotice('');
  });
  return()=>{epoch.current++;subscription.unsubscribe();};
 },[]);

 async function run(action?:{id:string;action:Decision}){
  if(inFlight.current)return;
  inFlight.current=true;setBusy(true);setNotice('');
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
   if(resolved)setNotice(action?.action==='hide'?'Post hidden and decision recorded.':'Report dismissed and decision recorded.');
  }catch{
   if(version!==epoch.current)return;
   setReports(null);setDecision(null);
   setNotice(resolved?'Decision recorded. Reload the queue to see remaining reports.':
    'Could not load or update group reports. Check your access and try again.');
  }finally{
   inFlight.current=false;setBusy(false);
  }
 }

 return <section className="card" aria-labelledby="group-reports-title">
  <h2 id="group-reports-title">Group post reports</h2>
  <button type="button" className="btn secondary" disabled={busy} onClick={()=>void run()}>
   {busy?'Working…':reports?'Refresh group reports':'Load group reports'}
  </button>
  {notice&&<p role="status" className="notice">{notice}</p>}
  {reports?.length===0&&<p>No pending group post reports.</p>}
  {reports?.map(report=><article className="notice" key={report.id}>
   <h3>{report.category} report</h3>
   <p className="muted-note">{readablePostDate(report.created_at)}</p>
   <blockquote style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{report.post_body}</blockquote>
   {report.explanation&&<p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>Reporter details: {report.explanation}</p>}
   {decision?.id===report.id?<div role="group" aria-label="Confirm moderation decision" className="social-hub-shortcuts">
    <button type="button" className="btn" disabled={busy} onClick={()=>void run(decision)}>
     {decision.action==='hide'?'Confirm hide post':'Confirm dismiss report'}
    </button>
    <button type="button" className="btn secondary" disabled={busy} onClick={()=>setDecision(null)}>Cancel</button>
   </div>:<div className="social-hub-shortcuts">
    <button type="button" className="btn secondary" disabled={busy} onClick={()=>setDecision({id:report.id,action:'hide'})}>Hide post</button>
    <button type="button" className="btn secondary" disabled={busy} onClick={()=>setDecision({id:report.id,action:'dismiss'})}>Dismiss report</button>
   </div>}
  </article>)}
 </section>;
}
