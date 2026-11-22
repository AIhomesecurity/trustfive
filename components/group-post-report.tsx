'use client';

import {useId,useRef,useState,type FormEvent} from 'react';
import {supabaseBrowser} from '../lib/supabase';
import {SOCIAL_REPORT_CATEGORIES,socialReportError} from '../lib/social-discussion';

export default function GroupPostReport({postId,userId}:{postId:string;userId:string}){
 const formId=useId();
 const inFlight=useRef(false);
 const [open,setOpen]=useState(false);
 const [category,setCategory]=useState('');
 const [explanation,setExplanation]=useState('');
 const [busy,setBusy]=useState(false);
 const [submitted,setSubmitted]=useState(false);
 const [notice,setNotice]=useState('');

 async function submit(event:FormEvent){
  event.preventDefault();
  if(inFlight.current||submitted||!userId||socialReportError(category,explanation))return;
  inFlight.current=true;setBusy(true);setNotice('');
  try{
   const {error}=await supabaseBrowser().from('community_group_post_reports').insert({
    post_id:postId,reporter_id:userId,category,explanation:explanation.trim()||null
   });
   if(error&&error.code!=='23505')throw error;
   setSubmitted(true);setOpen(false);setExplanation('');
   setNotice(error?'You already reported this post.':'Report sent to TrustFive moderators.');
  }catch{
   setNotice('The report could not be submitted. Please try again.');
  }finally{
   inFlight.current=false;setBusy(false);
  }
 }

 return <div>
  {!submitted&&<button type="button" className="btn secondary" aria-expanded={open} aria-controls={formId}
   disabled={busy} onClick={()=>{setOpen(value=>!value);setNotice('');}}>{open?'Cancel report':'Report group post'}</button>}
  <div id={formId} hidden={!open}>{open&&<form className="form" aria-label="Report this group post" onSubmit={submit}>
   <p className="muted-note">TrustFive moderators can review this post. Please avoid repeating private information in your report.</p>
   <label>Reason<select required value={category} disabled={busy} onChange={event=>setCategory(event.target.value)}>
    <option value="">Choose a reason</option>
    {SOCIAL_REPORT_CATEGORIES.map(reason=><option key={reason} value={reason}>
     {reason==='privacy'?'Private information':reason==='abuse'?'Abusive content':reason==='spam'?'Spam':'Other concern'}
    </option>)}
   </select></label>
   <label>Details (optional)<textarea value={explanation} maxLength={1200} disabled={busy}
    onChange={event=>setExplanation(event.target.value)}/></label>
   <button className="btn" type="submit" disabled={busy||Boolean(socialReportError(category,explanation))}>
    {busy?'Sending…':'Submit report'}
   </button>
  </form>}</div>
  {notice&&<p className="notice" role="status">{notice}</p>}
 </div>;
}
