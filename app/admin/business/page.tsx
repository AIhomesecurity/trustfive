'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../../lib/supabase';
type BusinessPage={application_id:string;display_name:string;description:string;website_url:string|null;public_phone:string|null;status:string;review_note:string|null};
export default function AdminBusinessPages(){
 const [admin,setAdmin]=useState(false),[loading,setLoading]=useState(true);
 const [pages,setPages]=useState<BusinessPage[]>([]),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [reason,setReason]=useState('');
 async function reload(){
  const {data,error}=await supabaseBrowser().from('professional_business_pages')
   .select('application_id,display_name,description,website_url,public_phone,status,review_note')
   .order('created_at',{ascending:false}).limit(100);
  if(error)throw error;setPages(data||[]);
 }
 useEffect(()=>{(async()=>{try{
  const {data,error}=await supabaseBrowser().rpc('is_trustfive_admin');
  if(error)throw error;setAdmin(data===true);if(data)await reload();
 }catch(e){setNotice(e instanceof Error?e.message:'Unable to verify administrator permissions');}
 finally{setLoading(false);}})()},[]);
 async function review(id:string,approve:boolean){if(busy)return;setBusy(true);setNotice('');
  try{
   if(reason.trim().length<20)throw Error('Record the evidence and rationale (at least 20 characters).');
   const {error}=await supabaseBrowser().rpc('review_business_page',{
    p_application:id,p_approve:approve,p_reason:reason.trim()
   });
   if(error)throw error;await reload();setReason('');
   setNotice(approve?'Published after independent review.':'Returned to the owner as a draft with reviewer feedback.');
  }catch(e){setNotice(e instanceof Error?e.message:'Unable to save review');}
  finally{setBusy(false);}
 }
 return <main className="container">
  <div className="page-heading"><span className="eyebrow">TrustFive restricted moderation</span><h1>Review business profiles</h1>
   <p className="subtle"><Link href="/admin">← Admin dashboard</Link></p></div>
  {loading&&<p>Checking access…</p>}{notice&&<p className="notice" role="status">{notice}</p>}
  {!loading&&!admin&&<p className="notice error">Administrator approval required.</p>}
  {admin&&<><div className="card" style={{marginBottom:26}}>
   <h2>Reviewer guidance</h2>
   <p>Publication requires a verified active TrustFive professional slot, content checks and documented review. Optional memberships do not influence publication or ranking.</p>
   <label style={{display:'grid',gap:8,marginTop:16}}>Review evidence or rationale
    <textarea required minLength={20} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/>
   </label>
  </div><div className="list">
   {pages.length===0&&<div className="card">No business profiles have been submitted.</div>}
   {pages.map(p=><article className="card" key={p.application_id}>
    <span className="pill">{p.status}</span><h2 style={{marginTop:10}}>{p.display_name}</h2>
    <p style={{whiteSpace:'pre-wrap'}}>{p.description}</p>
    {p.website_url&&<p style={{marginTop:12}}>Website: {p.website_url}</p>}
    {p.public_phone&&<p>Public business phone: {p.public_phone}</p>}
    {p.review_note&&<p className="muted-note" style={{marginTop:10}}>Previous note: {p.review_note}</p>}
    {(p.status==='submitted'||p.status==='published')&&<div style={{display:'flex',gap:12,marginTop:16,flexWrap:'wrap'}}>
     <button className="btn" disabled={busy} onClick={()=>review(p.application_id,true)}>Approve verified page</button>
     <button className="btn secondary" disabled={busy} onClick={()=>review(p.application_id,false)}>Reject / return for changes</button>
    </div>}
   </article>)}
  </div></>}
 </main>;
}
